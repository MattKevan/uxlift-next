// /app/api/process-feeds/route.ts

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Create a service role client for automated operations
const createServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleSecret = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient<Database>(supabaseUrl, serviceRoleSecret)
}

export async function GET(request: Request) {
  try {
    // Validate the request
    const supabase = await createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active sites
    const serviceClient = createServiceClient()
    const { data: sites, error: sitesError } = await serviceClient
      .from('content_site')
      .select('*')
      .eq('include_in_newsfeed', true)
      .not('feed_url', 'is', null)

    if (sitesError) throw sitesError

    // Create a background job record
    const { data: job, error: jobError } = await serviceClient
      .from('feed_processing_jobs')
      .insert([
        { 
          status: 'pending',
          total_sites: sites?.length || 0,
          created_by: user.id
        }
      ])
      .select()
      .single()

    if (jobError) throw jobError

    // Trigger the background processing
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/process-feeds-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      body: JSON.stringify({ jobId: job.id })
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Feed processing started in background'
    })

  } catch (error) {
    console.error('Process feeds error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}