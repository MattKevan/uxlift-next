// app/api/admin/activity-logs/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const functionName = searchParams.get('function')
    const status = searchParams.get('status')
    
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
    
    // Build the query
    let query = supabase
      .from('admin_activity_logs')
      .select('*', { count: 'exact' })
      
    // Add filters
    if (functionName) {
      query = query.eq('function_name', functionName)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    // Add pagination and ordering
    query = query
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    const { data: logs, error: logsError, count } = await query
    
    if (logsError) {
      console.error('Error fetching logs:', logsError)
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }
    
    // Fetch active jobs
    const { data: activeJobs, error: jobsError } = await supabase
      .from('feed_processing_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
    
    if (jobsError) {
      console.error('Error fetching active jobs:', jobsError)
      // Continue anyway, as this is secondary information
    }
    
    return NextResponse.json({
      logs,
      activeJobs: activeJobs || [],
      pagination: {
        total: count || 0,
        offset,
        limit
      }
    })
  } catch (error) {
    console.error('Unexpected error in API route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}