import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { reprocessTool } from '@/utils/tool-tools/fetch-tool-content'
import { reprocessToolRequestSchema, validateApiRequest } from '@/utils/validation'

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
    const { toolId, description } = validateApiRequest(
      reprocessToolRequestSchema,
      body,
      '/api/tools/reprocess'
    )

    const updatedTool = await reprocessTool(toolId, supabase, {
      description,
    })

    console.log('[tools reprocess] completed', {
      toolId,
      title: updatedTool.title,
    })

    return NextResponse.json({
      success: true,
      tool: updatedTool,
    })
  } catch (error) {
    console.error('[tools reprocess] failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reprocess tool',
      },
      { status: 500 }
    )
  }
}
