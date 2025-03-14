// supabase/functions/process-feeds-worker/job-manager.ts
import { EdgeFunctionLogger } from '../_shared/logger.ts'

// Get job details
export async function getJob(jobId: number, supabase: any, logger: EdgeFunctionLogger | null) {
  try {
    const { data, error: jobError } = await supabase
      .from('feed_processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (jobError || !data) {
      console.error(`Failed to fetch job ${jobId}:`, jobError)
      if (logger) {
        await logger.endStep('get_job_details', false, 'Job not found')
        await logger.complete(false, {}, new Error('Job not found'))
      }
      throw new Error(`Job not found: ${jobError?.message || 'No data returned'}`)
    }
    
    console.log(`Job ${jobId} details:`, {
      status: data.status,
      currentBatch: data.current_batch,
      totalBatches: data.total_batches,
      processedItems: data.processed_items
    })
    
    return data
  } catch (fetchJobError) {
    console.error('Error fetching job details:', fetchJobError)
    if (logger) {
      await logger.endStep('get_job_details', false, 'Error fetching job details', 
        { error: fetchJobError instanceof Error ? fetchJobError.message : 'Unknown error' })
      await logger.complete(false, {}, fetchJobError instanceof Error ? fetchJobError : new Error('Unknown error'))
    }
    throw fetchJobError
  }
}

// Update job status for a site
export async function updateJobSiteStatus(
  jobId: number, 
  batchNumber: number, 
  currentSite: string, 
  siteId: number, 
  supabase: any
) {
  try {
    await supabase
      .from('feed_processing_jobs')
      .update({
        status: 'processing',
        current_batch: batchNumber,
        current_site: currentSite,
        last_processed_site_id: siteId,
        last_updated: new Date().toISOString()
      })
      .eq('id', jobId)
    
    console.log(`Updated job ${jobId} status with current site: ${currentSite}`)
  } catch (updateError) {
    console.error(`Failed to update job ${jobId} status:`, updateError)
    // Continue processing even if update fails
  }
}

// Update job progress
export async function updateJobProgress(
  job: any, 
  results: { processed: number; errors: number; sites: number }, 
  startTime: number,
  supabase: any,
  logger: EdgeFunctionLogger | null
) {
  try {
    console.log(`Updating job ${job.id} progress:`, {
      processedSites: job.processed_sites + results.sites,
      processedItems: job.processed_items + results.processed,
      errorCount: job.error_count + results.errors,
      duration: Math.round((Date.now() - startTime) / 1000)
    })
    
    const { data, error: updateError } = await supabase
      .from('feed_processing_jobs')
      .update({
        processed_sites: job.processed_sites + results.sites,
        processed_items: job.processed_items + results.processed,
        error_count: job.error_count + results.errors,
        last_updated: new Date().toISOString(),
        duration: job.duration 
          ? job.duration + Math.round((Date.now() - startTime) / 1000) 
          : Math.round((Date.now() - startTime) / 1000)
      })
      .eq('id', job.id)
      .select()
      .single()
    
    if (updateError) {
      console.error(`Failed to update job ${job.id} progress:`, updateError)
      if (logger) await logger.endStep('update_job_progress', false, 'Failed to update job progress', 
        { error: updateError.message })
      return job
    } else {
      console.log(`Successfully updated job ${job.id} progress`)
      if (logger) await logger.endStep('update_job_progress', true, 'Job progress updated', { 
        processed_sites: job.processed_sites + results.sites,
        processed_items: job.processed_items + results.processed,
        error_count: job.error_count + results.errors,
        duration: data.duration
      })
      return data
    }
  } catch (updateJobError) {
    console.error('Error updating job progress:', updateJobError)
    if (logger) await logger.endStep('update_job_progress', false, 'Error updating job progress', 
      { error: updateJobError instanceof Error ? updateJobError.message : 'Unknown error' })
    return job
  }
}

// Complete job
export async function completeJob(
  jobId: number, 
  results: { processed: number; errors: number }, 
  startTime: number,
  supabase: any,
  logger: EdgeFunctionLogger | null
) {
  try {
    console.log(`Marking job ${jobId} as completed`)
    const { error: updateError } = await supabase
      .from('feed_processing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      
    if (updateError) {
      console.error(`Failed to mark job ${jobId} as completed:`, updateError)
      if (logger) await logger.endStep('complete_job', false, 'Failed to mark job as completed', 
        { error: updateError.message })
    } else {
      console.log(`Successfully marked job ${jobId} as completed`)
    }
    
    // Create completion event for future extensions
    try {
      console.log(`Creating completion event for job ${jobId}`)
      await supabase
        .from('feed_processing_events')
        .insert([{
          job_id: jobId,
          event_type: 'job_completed',
          payload: {
            processed_items: results.processed,
            error_count: results.errors,
            duration: Date.now() - startTime,
            completed_at: new Date().toISOString()
          }
        }])
        
      console.log(`Successfully created completion event for job ${jobId}`)
    } catch (eventError) {
      console.error(`Error creating completion event for job ${jobId}:`, eventError)
      // Continue even if event creation fails
    }
  } catch (completeJobError) {
    console.error(`Error marking job ${jobId} as completed:`, completeJobError)
    if (logger) await logger.endStep('complete_job', false, 'Error marking job as completed', 
      { error: completeJobError instanceof Error ? completeJobError.message : 'Unknown error' })
  }
}

// Fail job
export async function failJob(jobId: number, error: any, supabase: any) {
  try {
    console.log(`Marking job ${jobId} as failed`)
    const { error: updateError } = await supabase
      .from('feed_processing_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        last_updated: new Date().toISOString()
      })
      .eq('id', jobId)
      
    if (updateError) {
      console.error(`Failed to update job ${jobId} status:`, updateError)
    } else {
      console.log(`Successfully updated job ${jobId} status to failed`)
      
      // Create error event
      try {
        await supabase
          .from('feed_processing_events')
          .insert([{
            job_id: jobId,
            event_type: 'job_error',
            payload: {
              error: error instanceof Error ? error.message : 'Unknown error',
              errorType: error instanceof Error ? error.name : 'Unknown',
              timestamp: new Date().toISOString()
            }
          }])
      } catch (eventError) {
        console.error(`Failed to create error event for job ${jobId}:`, eventError)
      }
    }
  } catch (updateError) {
    console.error('Failed to update job status:', updateError)
  }
}