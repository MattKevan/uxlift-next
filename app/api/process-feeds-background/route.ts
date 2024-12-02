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

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    
    // Verify either cron secret or internal secret
    if (
      authHeader !== `Bearer ${process.env.CRON_SECRET}` && 
      authHeader !== `Bearer ${process.env.INTERNAL_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { jobId, isCron, userId } = await request.json()

    // If it's not a cron job, verify user session
    if (!isCron) {
      const supabase = await createServerClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user || user.id !== userId) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
      }

      // Verify admin status
      const serviceClient = createServiceClient()
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single()

      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
      }
    }

    const serviceClient = createServiceClient()

    // Process feeds in background
    const result = await processFeedItems(serviceClient, async (progress) => {
      // Update job status
      await serviceClient
        .from('feed_processing_jobs')
        .update({
          status: 'processing',
          processed_sites: progress.processed,
          error_count: progress.errors,
          current_site: progress.currentSite,
          processed_items: progress.processed
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
        error_count: result.errors
      })
      .eq('id', jobId)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Background processing error:', error)

    try {
      const { jobId } = await request.json()
      if (jobId) {
        const serviceClient = createServiceClient()
        
        await serviceClient
          .from('feed_processing_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', jobId)
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError)
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}