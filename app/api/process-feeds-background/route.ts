// /app/api/process-feeds-background/route.ts

import { NextResponse } from 'next/server'
import { processFeedItems } from '@/utils/post-tools/process-feeds'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  // Verify the request is authorized
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = await request.json()

  try {
    // Process feeds in background
    const result = await processFeedItems(supabase, async (progress) => {
      // Update job status
      await supabase
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
    await supabase
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
    // Update job as failed
    await supabase
      .from('feed_processing_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', jobId)

    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}