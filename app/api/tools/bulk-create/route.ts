import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  fetchAndProcessTool,
  getToolUrlLookupVariants,
  normalizeToolUrl
} from '@/utils/tool-tools/fetch-tool-content'
import { validateApiRequest, bulkCreateToolsRequestSchema } from '@/utils/validation'

interface BulkResultItem {
  url: string
  status: 'created' | 'existing' | 'failed'
  toolId?: number
  title?: string
  error?: string
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
    const { urls, status } = validateApiRequest(
      bulkCreateToolsRequestSchema,
      body,
      '/api/tools/bulk-create'
    )

    const uniqueUrls = Array.from(new Set(urls.map((url) => url.trim())))
    const results: BulkResultItem[] = []

    for (const rawUrl of uniqueUrls) {
      let normalizedUrlForResult = rawUrl
      try {
        const url = normalizeToolUrl(rawUrl)
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
