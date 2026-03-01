import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { reprocessResource } from '@/utils/resource-tools/fetch-resource-content'
import { reprocessResourceRequestSchema, validateApiRequest } from '@/utils/validation'

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
    const { resourceId } = validateApiRequest(
      reprocessResourceRequestSchema,
      body,
      '/api/resources/reprocess'
    )

    const updatedResource = await reprocessResource(resourceId, supabase)

    return NextResponse.json({
      success: true,
      resource: updatedResource,
    })
  } catch (error) {
    console.error('[resources reprocess] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reprocess resource',
      },
      { status: 500 }
    )
  }
}
