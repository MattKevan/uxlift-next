import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { validateApiRequest, bulkCreateToolsRequestSchema } from '@/utils/validation'

interface BulkResultItem {
  url: string
  status: 'created' | 'existing' | 'failed'
  toolId?: number
  title?: string
  error?: string
}

interface BulkInputItem {
  url: string
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

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
    const { urls, items, status } = validateApiRequest(
      bulkCreateToolsRequestSchema,
      body,
      '/api/tools/bulk-create'
    )

    const {
      fetchAndProcessTool,
      getToolUrlLookupVariants,
      normalizeToolUrl,
    } = await import('@/utils/tool-tools/fetch-tool-content')

    const requestItems: BulkInputItem[] = [
      ...(items || []),
      ...((urls || []).map((url) => ({ url }))),
    ]

    const uniqueItems: BulkInputItem[] = []
    const seenUrls = new Set<string>()

    for (const item of requestItems) {
      const normalized = normalizeToolUrl(item.url.trim())
      if (seenUrls.has(normalized)) {
        continue
      }

      seenUrls.add(normalized)
      uniqueItems.push({
        url: normalized,
        description: item.description?.trim() || undefined,
      })
    }

    const results: BulkResultItem[] = []

    for (const item of uniqueItems) {
      let normalizedUrlForResult = item.url
      try {
        const url = normalizeToolUrl(item.url.trim())
        normalizedUrlForResult = url
        const lookupUrls = getToolUrlLookupVariants(url)
        const { data: existingTools } = await supabase
          .from('content_tool')
          .select('id, title')
          .in('link', lookupUrls)
          .limit(1)

        const existingTool = existingTools?.[0]
        if (existingTool) {
          results.push({
            url,
            status: 'existing',
            toolId: existingTool.id,
            title: existingTool.title,
          })
          continue
        }

        const result = await fetchAndProcessTool(url, supabase, {
          user_id: profile.id,
          status: status || 'D',
          description: item.description,
        })

        results.push({
          url,
          status: result.created ? 'created' : 'existing',
          toolId: result.tool.id,
          title: result.tool.title,
        })
      } catch (error) {
        results.push({
          url: normalizedUrlForResult,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const created = results.filter((item) => item.status === 'created').length
    const existing = results.filter((item) => item.status === 'existing').length
    const failed = results.filter((item) => item.status === 'failed').length

    console.log('[tools bulk-create] completed', {
      total: results.length,
      created,
      existing,
      failed,
    })

    return NextResponse.json({
      success: true,
      total: results.length,
      created,
      existing,
      failed,
      results,
    })
  } catch (error) {
    console.error('[tools bulk-create] failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk creation failed',
      },
      { status: 500 }
    )
  }
}
