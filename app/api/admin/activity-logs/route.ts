import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

interface ActivityLog {
  id: number;
  function_name: string;
  execution_id: string;
  job_id: number | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  success: boolean | null;
  error: string | null;
  items_processed: number;
  items_failed: number;
  total_sites: number | null;
  processed_sites: number | null;
  total_batches: number | null;
  current_batch: number | null;
  batch_size: number | null;
  current_site: string | null;
  total_steps: number;
  successful_steps: number;
}

interface Job {
  id: number;
  status: string;
  job_type: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  processed_items: number;
  error_count: number;
  current_site: string | null;
  current_batch: number | null;
  total_batches: number | null;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verify admin user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify admin status
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()
    
    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
    }
    
    // Parse query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const functionName = url.searchParams.get('function')
    const status = url.searchParams.get('status')
    
    // First get total count
    let countQuery = supabase
      .from('admin_activity_logs')
      .select('id', { count: 'exact' })
    
    if (functionName) {
      countQuery = countQuery.eq('function_name', functionName)
    }
    
    if (status) {
      countQuery = countQuery.eq('status', status)
    }
    
    const { count, error: countError } = await countQuery
    
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }
    
    // Now get the actual data
    let dataQuery = supabase
      .from('admin_activity_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (functionName) {
      dataQuery = dataQuery.eq('function_name', functionName)
    }
    
    if (status) {
      dataQuery = dataQuery.eq('status', status)
    }
    
    const { data, error: logsError } = await dataQuery
    
    if (logsError) {
      return NextResponse.json({ error: logsError.message }, { status: 500 })
    }
    
    const logs = data || [] as ActivityLog[]
    
    // Get job details for active jobs
    const activeJobIds = logs
      .filter((log: ActivityLog) => log.job_id && ['started', 'processing'].includes(log.status))
      .map((log: ActivityLog) => log.job_id)
      .filter(Boolean) as number[]
    
    let activeJobs: Job[] = []
    if (activeJobIds.length > 0) {
      const { data: jobs } = await supabase
        .from('feed_processing_jobs')
        .select('*')
        .in('id', activeJobIds)
      
      activeJobs = jobs || []
    }
    
    // Get all active jobs (not just those in the current logs page)
    const { data: allActiveJobs } = await supabase
      .from('feed_processing_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
    
    return NextResponse.json({
      logs,
      activeJobs: allActiveJobs || [],
      pagination: {
        total: count || 0,
        offset,
        limit
      }
    })
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}