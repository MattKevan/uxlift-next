import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/types/supabase'
import { slugify } from '@/utils/slugify'
import { convertToolTypeRequestSchema, validateApiRequest } from '@/utils/validation'

type DestinationType = 'post' | 'resource'

function normalizeStatus(status: string | null | undefined): 'published' | 'draft' {
  if (status === 'P' || status === 'published') return 'published'
  return 'draft'
}

function toIsoDate(value: string | null | undefined): string {
  if (!value) return new Date().toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

async function generateUniqueSlug(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  table: 'content_post' | 'content_resource'
  base: string
}) {
  const { supabase, table } = params
  const normalizedBase = params.base || `${table}-${Date.now()}`
  let candidate = normalizedBase
  let counter = 2

  while (true) {
    const { data } = await supabase
      .from(table)
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()

    if (!data) return candidate

    candidate = `${normalizedBase}-${counter}`
    counter += 1
  }
}

async function rollbackDestination(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  destinationType: DestinationType
  destinationId: number
}) {
  const { supabase, destinationType, destinationId } = params

  if (destinationType === 'post') {
    await supabase.from('content_post_topics').delete().eq('post_id', destinationId)
    await supabase.from('content_post').delete().eq('id', destinationId)
    return
  }

  await supabase.from('content_resource_topics').delete().eq('resource_id', destinationId)
  await supabase.from('content_resource').delete().eq('id', destinationId)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, is_admin')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { toolId, destinationType } = validateApiRequest(
      convertToolTypeRequestSchema,
      body,
      '/api/tools/change-type'
    )

    const { data: tool, error: toolError } = await supabase
      .from('content_tool')
      .select('*')
      .eq('id', toolId)
      .single()

    if (toolError || !tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }

    const { data: toolTopics, error: toolTopicsError } = await supabase
      .from('content_tool_topics')
      .select('topic_id')
      .eq('tool_id', toolId)

    if (toolTopicsError) {
      throw new Error(toolTopicsError.message || 'Failed to fetch tool topics')
    }

    const normalizedStatus = normalizeStatus(tool.status)
    const sourceDateIso = toIsoDate(tool.date)
    const topicIds = (toolTopics || []).map((item) => item.topic_id)
    const baseSlug = slugify(tool.slug || tool.title || 'item')
    const destinationUserId = tool.user_id ?? profile.id

    let destinationId: number | null = null
    let destinationSlug: string | null = null

    if (destinationType === 'post') {
      const uniqueSlug = await generateUniqueSlug({
        supabase,
        table: 'content_post',
        base: baseSlug,
      })

      const postInsert: Database['public']['Tables']['content_post']['Insert'] = {
        title: tool.title,
        description: tool.description || '',
        summary: tool.description || '',
        content: tool.body || null,
        link: tool.link,
        image_path: tool.image || null,
        date_created: sourceDateIso,
        date_published: normalizedStatus === 'published' ? sourceDateIso : null,
        site_id: null,
        status: normalizedStatus,
        tags_list: null,
        indexed: false,
        slug: uniqueSlug,
        user_id: destinationUserId,
      }

      const { data: createdPost, error: createPostError } = await supabase
        .from('content_post')
        .insert([postInsert])
        .select('id, slug')
        .single()

      if (createPostError || !createdPost) {
        if (createPostError?.code === '23505') {
          return NextResponse.json(
            { error: 'Cannot convert: destination post already exists with same link or slug' },
            { status: 409 }
          )
        }

        throw new Error(createPostError?.message || 'Failed to create destination post')
      }

      destinationId = createdPost.id
      destinationSlug = createdPost.slug

      if (topicIds.length > 0) {
        const { error: insertTopicsError } = await supabase
          .from('content_post_topics')
          .insert(topicIds.map((topicId) => ({ post_id: destinationId as number, topic_id: topicId })))

        if (insertTopicsError) {
          await rollbackDestination({
            supabase,
            destinationType,
            destinationId: createdPost.id,
          })
          throw new Error(insertTopicsError.message || 'Failed to assign post topics')
        }
      }
    } else {
      const uniqueSlug = await generateUniqueSlug({
        supabase,
        table: 'content_resource',
        base: baseSlug,
      })

      const resourceInsert: Database['public']['Tables']['content_resource']['Insert'] = {
        title: tool.title,
        description: tool.description || '',
        summary: tool.description || '',
        body: tool.body || null,
        link: tool.link,
        image_path: tool.image || null,
        slug: uniqueSlug,
        status: normalizedStatus,
        date_created: sourceDateIso,
        date_published: normalizedStatus === 'published' ? sourceDateIso : null,
        user_id: destinationUserId,
        resource_category_id: null,
      }

      const { data: createdResource, error: createResourceError } = await supabase
        .from('content_resource')
        .insert([resourceInsert])
        .select('id, slug')
        .single()

      if (createResourceError || !createdResource) {
        if (createResourceError?.code === '23505') {
          return NextResponse.json(
            { error: 'Cannot convert: destination resource already exists with same link or slug' },
            { status: 409 }
          )
        }

        throw new Error(createResourceError?.message || 'Failed to create destination resource')
      }

      destinationId = createdResource.id
      destinationSlug = createdResource.slug

      if (topicIds.length > 0) {
        const { error: insertTopicsError } = await supabase
          .from('content_resource_topics')
          .insert(topicIds.map((topicId) => ({ resource_id: destinationId as number, topic_id: topicId })))

        if (insertTopicsError) {
          await rollbackDestination({
            supabase,
            destinationType,
            destinationId: createdResource.id,
          })
          throw new Error(insertTopicsError.message || 'Failed to assign resource topics')
        }
      }
    }

    const { error: deleteToolTopicsError } = await supabase
      .from('content_tool_topics')
      .delete()
      .eq('tool_id', toolId)

    if (deleteToolTopicsError) {
      if (destinationId !== null) {
        await rollbackDestination({
          supabase,
          destinationType,
          destinationId,
        })
      }

      throw new Error(deleteToolTopicsError.message || 'Failed to remove source tool topics')
    }

    const { error: deleteToolError } = await supabase
      .from('content_tool')
      .delete()
      .eq('id', toolId)

    if (deleteToolError) {
      if (destinationId !== null) {
        await rollbackDestination({
          supabase,
          destinationType,
          destinationId,
        })
      }

      throw new Error(deleteToolError.message || 'Failed to remove source tool')
    }

    return NextResponse.json({
      success: true,
      sourceToolId: toolId,
      destinationType,
      destinationId,
      destinationSlug,
    })
  } catch (error) {
    console.error('[tools change-type] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to change content type',
      },
      { status: 500 }
    )
  }
}
