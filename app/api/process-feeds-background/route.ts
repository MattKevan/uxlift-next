// /app/api/process-feeds-background/route.ts

import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { processFeedItems } from '@/utils/post-tools/process-feeds'
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

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startTime = Date.now()
  const serviceClient = createServiceClient()

  try {
    const authHeader = request.headers.get('authorization')
    
    // Verify either cron secret or internal secret
    if (
      authHeader !== `Bearer ${process.env.CRON_SECRET}` && 
      authHeader !== `Bearer ${process.env.INTERNAL_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Type check and validate jobId
    if (!body.jobId || typeof body.jobId !== 'number') {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
    }

    const { jobId, isCron, userId } = body

    // If it's not a cron job, verify user session
    if (!isCron) {
      const supabase = await createServerClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user || user.id !== userId) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
      }

      // Verify admin status
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single()

      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
      }
    }

    // Update job status to processing
    await serviceClient
      .from('feed_processing_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId)

    // Process feeds with progress updates
    const result = await processFeedItems(serviceClient, async (progress) => {
      // Check if we're approaching the time limit
      if (Date.now() - startTime > (maxDuration - 30) * 1000) {
        throw new Error('Approaching time limit, stopping gracefully')
      }

      // Update job status
      await serviceClient
        .from('feed_processing_jobs')
        .update({
          status: 'processing',
          processed_sites: progress.processed,
          error_count: progress.errors,
          current_site: progress.currentSite,
          processed_items: progress.processed,
          last_updated: new Date().toISOString()
        })
        .eq('id', jobId)
    })

    // Update job as completed
    await serviceClient
      .from('feed_processing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_items: result.processed,
        error_count: result.errors,
        duration: Math.round((Date.now() - startTime) / 1000)
      })
      .eq('id', jobId)

    return NextResponse.json({ 
      success: true,
      processed: result.processed,
      errors: result.errors,
      duration: Math.round((Date.now() - startTime) / 1000)
    })

  } catch (error) {
    console.error('Background processing error:', error)

    // Get jobId from request body again if needed
    try {
      const { jobId } = await request.json()
      
      if (jobId && typeof jobId === 'number') {
        await serviceClient
          .from('feed_processing_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Math.round((Date.now() - startTime) / 1000)
          })
          .eq('id', jobId)
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError)
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Math.round((Date.now() - startTime) / 1000)
      }, 
      { status: 500 }
    )
  }
}