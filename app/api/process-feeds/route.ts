// /app/api/process-feeds/route.ts

import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

// Create a service role client for automated operations
const createServiceClient = () => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

async function validateRequest(request: Request) {
  // Check for cron secret first
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isCron: true }
  }

  // If not cron, check for user authentication
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  // Verify admin status using service client
  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single()

  if (!profile?.is_admin) {
    throw new Error('Unauthorized: Admin access required')
  }

  return { isCron: false, userId: user.id }
}

export async function GET(request: Request) {
  try {
    // Validate the request
    const { isCron, userId } = await validateRequest(request)

    const serviceClient = createServiceClient()
    
    // Get all active sites for total count
    const { data: sites, error: sitesError } = await serviceClient
      .from('content_site')
      .select('*')
      .eq('include_in_newsfeed', true)
      .not('feed_url', 'is', null)

    if (sitesError) throw sitesError

    // Create a job record
    const { data: job, error: jobError } = await serviceClient
      .from('feed_processing_jobs')
      .insert([
        { 
          status: 'pending',
          total_sites: sites?.length || 0,
          created_by: userId || '00000000-0000-0000-0000-000000000000',
          is_cron: isCron
        }
      ])
      .select()
      .single()

    if (jobError) throw jobError

    // Get cookies if it's a user request
    const cookieStore = await cookies()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': isCron 
        ? `Bearer ${process.env.CRON_SECRET}` 
        : `Bearer ${process.env.INTERNAL_SECRET}`
    }

    // Add cookies if it's a user request
    if (!isCron) {
      headers['Cookie'] = cookieStore.getAll()
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ')
    }

    // Start background processing
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    const response = await fetch(`${baseUrl}/api/process-feeds-background`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        jobId: job.id,
        isCron,
        userId 
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Background process failed to start')
    }

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
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}