import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { fetchAndProcessTool } from '@/utils/tool-tools/fetch-tool-content'
import { validateApiRequest, createToolRequestSchema } from '@/utils/validation'

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
    const { url, status } = validateApiRequest(createToolRequestSchema, body, '/api/tools/create')

    const result = await fetchAndProcessTool(url, supabase, {
      user_id: profile.id,
      status: status || 'D',
    })

    return NextResponse.json({
      success: true,
      created: result.created,
      tool: result.tool,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create tool',
      },
      { status: 500 }
    )
  }
}
