// app/api/admin/activity-logs/[id]/steps/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const id = context.params.id
    const supabase = await createClient()

    // Check user permission (must be admin)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile || !profile.is_admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    // Fetch the steps for the specified log ID
    const { data: steps, error: stepsError } = await supabase
      .from('edge_function_steps')
      .select('*')
      .eq('log_id', id)
      .order('started_at', { ascending: true })

    if (stepsError) {
      console.error('Error fetching steps:', stepsError)
      return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 })
    }

    return NextResponse.json({
      steps: steps || [],
      logId: id
    })
  } catch (error) {
    console.error('Unexpected error in API route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}