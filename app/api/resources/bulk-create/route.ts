import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  fetchAndProcessResource,
  getResourceUrlLookupVariants,
  normalizeResourceUrl,
} from '@/utils/resource-tools/fetch-resource-content'
import { validateApiRequest, bulkCreateResourcesRequestSchema } from '@/utils/validation'

interface BulkResultItem {
  url: string
  status: 'created' | 'existing' | 'failed'
  resourceId?: number
  title?: string
  error?: string
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
    const { urls, status } = validateApiRequest(
      bulkCreateResourcesRequestSchema,
      body,
      '/api/resources/bulk-create'
    )

    const uniqueUrls = Array.from(new Set(urls.map((url) => url.trim())))
    const results: BulkResultItem[] = []

    for (const rawUrl of uniqueUrls) {
      let normalizedUrlForResult = rawUrl
      try {
        const url = normalizeResourceUrl(rawUrl)
        normalizedUrlForResult = url
        const lookupUrls = getResourceUrlLookupVariants(url)

        const { data: existingResources } = await supabase
          .from('content_resource')
          .select('id, title')
          .in('link', lookupUrls)
          .limit(1)

        const existingResource = existingResources?.[0]
        if (existingResource) {
          results.push({
            url,
            status: 'existing',
            resourceId: existingResource.id,
            title: existingResource.title,
          })
          continue
        }

        const result = await fetchAndProcessResource(url, supabase, {
          user_id: profile.id,
          status: status || 'draft',
        })

        results.push({
          url,
          status: result.created ? 'created' : 'existing',
          resourceId: result.resource.id,
          title: result.resource.title,
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

    return NextResponse.json({
      success: true,
      total: results.length,
      created,
      existing,
      failed,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk creation failed',
      },
      { status: 500 }
    )
  }
}
