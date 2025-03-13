// supabase/functions/process-feeds-controller/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  
  // Initialize logger
  const logger = new EdgeFunctionLogger('process-feeds-controller')
  await logger.initialize()
  
  try {
    await logger.startStep('parse_request')
    const { jobId, isCron = true } = await req.json().catch(() => ({}))
    await logger.endStep('parse_request', true, 'Request parsed successfully', { jobId, isCron })
    
    // Create or retrieve job
    await logger.startStep('job_setup')
    let job
    
    if (jobId) {
      // Get existing job
      const { data, error } = await supabase
        .from('feed_processing_jobs')
        .select('*')
        .eq('id', jobId)
        .single()
        
      if (error) throw new Error(`Failed to retrieve job: ${error.message}`)
      job = data
    } else {
      // Check for already running job
      const { data: runningJobs } = await supabase
        .from('feed_processing_jobs')
        .select('id')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (runningJobs && runningJobs.length > 0) {
        await logger.endStep('job_setup', false, 'Another job is already running', { existingJobId: runningJobs[0].id })
        await logger.complete(false, {}, new Error('Another job is already running'))
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Another job is already running',
            jobId: runningJobs[0].id
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
      
      // Get count of sites to process
      await logger.startStep('count_sites')
      const { data: sites, error: sitesError } = await supabase
        .from('content_site')
        .select('id')
        .eq('include_in_newsfeed', true)
        .not('feed_url', 'is', null)
      
      if (sitesError) throw new Error(`Failed to count sites: ${sitesError.message}`)
      
      const totalSites = sites?.length || 0
      await logger.endStep('count_sites', true, `Found ${totalSites} sites to process`)
      
      // Calculate batching
      const batchSize = 5 // Process 5 sites per batch
      const totalBatches = Math.ceil(totalSites / batchSize)
      
      // Create new job
      const { data: newJob, error: jobError } = await supabase
        .from('feed_processing_jobs')
        .insert([{
          status: 'pending',
          job_type: 'feed_processing',
          is_cron: isCron,
          total_sites: totalSites,
          batch_size: batchSize,
          total_batches: totalBatches,
          metadata: {
            extensible: true,
            version: '1.0.0'
          }
        }])
        .select()
        .single()
      
      if (jobError) throw new Error(`Failed to create job: ${jobError.message}`)
      job = newJob
    }
    
    await logger.endStep('job_setup', true, 'Job setup completed', { jobId: job.id })
    
    // If job is pending, start it
    if (job.status === 'pending') {
      await logger.startStep('start_job')
      
      // Update job status
      const { error: updateError } = await supabase
        .from('feed_processing_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        })
        .eq('id', job.id)
      
      if (updateError) throw new Error(`Failed to update job: ${updateError.message}`)
      
      // Invoke first worker
      await logger.startStep('invoke_worker')
      await fetch(`${supabaseUrl}/functions/v1/process-feeds-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          jobId: job.id,
          batchNumber: 0
        })
      })
      await logger.endStep('invoke_worker', true, 'Worker invoked successfully', { batchNumber: 0 })
      
      await logger.endStep('start_job', true, 'Job started successfully')
    }
    
    await logger.complete(true, { itemsProcessed: 0 })
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Feed processing initiated',
        jobId: job.id
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Controller error:', error)
    
    await logger.complete(false, {}, error instanceof Error ? error : new Error('Unknown error'))
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})