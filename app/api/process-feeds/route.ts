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
    // Get the user's session
    const supabase = await createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

     // Pass the user's session token to the background process
     const { data: { session }, error: sessionError } = await supabase.auth.getSession()
     if (sessionError || !session) {
       throw new Error('Failed to get session')
     }
 
     const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
     const host = request.headers.get('host') || 'localhost:3000'
     const baseUrl = `${protocol}://${host}`
 
     const response = await fetch(`${baseUrl}/api/process-feeds-background`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${session.access_token}` // Use the session token instead of CRON_SECRET
       },
       body: JSON.stringify({ 
         jobId: job.id,
         userId: user.id 
       })
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