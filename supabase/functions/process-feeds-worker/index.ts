// supabase/functions/process-feeds-worker/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getJob, updateJobProgress, completeJob, failJob } from './job-manager.ts'
import { processSiteBatch } from './site-processor.ts'

// Maximum execution time (slightly under the 60s limit)
const MAX_EXECUTION_TIME = 55 * 1000 // 55 seconds

// Listen for shutdown events
addEventListener('beforeunload', (ev) => {
  console.log('Function will be shutdown due to', ev.detail?.reason)
})

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  let logger: EdgeFunctionLogger | null = null
  let supabase: any = null
  
  try {
    // Log environment availability
    console.log('Environment check:', {
      supabaseUrl: Boolean(Deno.env.get('SUPABASE_URL')),
      supabaseServiceKey: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
      openaiKey: Boolean(Deno.env.get('OPENAI_API_KEY')),
      pineconeApiKey: Boolean(Deno.env.get('PINECONE_API_KEY')),
      pineconeIndexName: Boolean(Deno.env.get('PINECONE_INDEX_NAME'))
    })
    
    // Initialize Supabase client
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    console.log('Supabase client created successfully')
    
    // Parse request
    const requestData = await req.json()
    console.log('Request data:', requestData)
    
    const { jobId, batchNumber } = requestData
    
    if (!jobId || batchNumber === undefined) {
      console.error('Missing required parameters:', { jobId, batchNumber })
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters',
          details: `Required: jobId (${jobId}), batchNumber (${batchNumber})`
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }
    
    // Initialize logger
    try {
      logger = new EdgeFunctionLogger('process-feeds-worker', jobId)
      await logger.initialize()
      console.log(`Logger initialized with ID: ${logger.logId} for job ${jobId}`)
    } catch (loggerError) {
      console.error('Failed to initialize logger:', loggerError)
      // Continue execution even if logger fails
    }
    
    // Get job details
    if (logger) await logger.startStep('get_job_details')
    const job = await getJob(jobId, supabase, logger)
    if (logger) await logger.endStep('get_job_details', true, 'Job details retrieved', { job })
    
    // Process sites
    const results = await processSiteBatch(job, batchNumber, supabase, logger, startTime, MAX_EXECUTION_TIME)
    
    // Update job progress
    if (logger) await logger.startStep('update_job_progress')
    const updatedJob = await updateJobProgress(job, results, startTime, supabase, logger)
    if (logger) await logger.endStep('update_job_progress', true, 'Job progress updated')
    
    // Determine if we need to process more batches
    const isLastBatch = batchNumber >= job.total_batches - 1
    const allSitesProcessed = results.sites < job.batch_size
    
    console.log('Determining next steps:', {
      batchNumber,
      totalBatches: job.total_batches,
      isLastBatch,
      sitesInBatch: results.sites,
      batchSize: job.batch_size,
      allSitesProcessed,
      elapsedTime: Date.now() - startTime
    })
    
    if (isLastBatch || allSitesProcessed) {
      // Job is complete
      if (logger) await logger.startStep('complete_job')
      await completeJob(jobId, results, startTime, supabase, logger)
      if (logger) {
        await logger.endStep('complete_job', true, 'Job completed successfully')
        await logger.complete(true, {
          itemsProcessed: results.processed,
          itemsFailed: results.errors
        })
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Feed processing completed',
          results: {
            processed: results.processed,
            errors: results.errors,
            duration: Math.round((Date.now() - startTime) / 1000)
          }
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    } else {
      // Schedule next batch
      if (logger) await logger.startStep('schedule_next_batch')
      
      console.log(`Scheduling next batch (${batchNumber + 1}) for job ${jobId}`)
      
      // Define the background task for processing the next batch
      const processNextBatch = async () => {
        try {
          console.log(`Starting background processing of batch ${batchNumber + 1} for job ${jobId}`)
          
          const workerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-feeds-worker`
          console.log(`Calling worker URL: ${workerUrl}`)
          
          // Process the next batch with a new HTTP request
          const nextBatchResponse = await fetch(workerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              jobId: jobId,
              batchNumber: batchNumber + 1
            })
          })
          
          if (!nextBatchResponse.ok) {
            // Log detailed error information
            const errorText = await nextBatchResponse.text().catch(() => 'Could not extract error details')
            console.error(`Next batch worker call failed with status ${nextBatchResponse.status}:`, errorText)
            throw new Error(`Worker responded with ${nextBatchResponse.status}: ${errorText}`)
          }
          
          const responseData = await nextBatchResponse.json().catch(() => null)
          console.log(`Completed background processing of batch ${batchNumber + 1}:`, responseData)
        } catch (error) {
          console.error(`Error in background processing of batch ${batchNumber + 1}:`, error)
          
          // Log detailed error information
          console.error('Background processing error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack trace'
          })
          
          // Update job status to failed if there's an error
          await failJob(jobId, error, supabase)
        }
      }
      
      try {
        // Use EdgeRuntime.waitUntil to run the next batch processing in the background
        console.log(`Using EdgeRuntime.waitUntil to schedule batch ${batchNumber + 1}`)
        EdgeRuntime.waitUntil(processNextBatch())
        console.log(`Successfully scheduled batch ${batchNumber + 1} using EdgeRuntime.waitUntil`)
      } catch (waitUntilError) {
        console.error(`Error using EdgeRuntime.waitUntil:`, waitUntilError)
        // If waitUntil fails, try to call the next batch directly
        try {
          console.log(`Attempting direct invocation of next batch as fallback`)
          processNextBatch().catch(e => console.error('Error in direct next batch invocation:', e))
        } catch (directCallError) {
          console.error(`Error in direct next batch invocation attempt:`, directCallError)
        }
      }
      
      if (logger) {
        await logger.endStep('schedule_next_batch', true, 'Next batch scheduled as background task', 
          { nextBatch: batchNumber + 1, jobId })
        await logger.complete(true, {
          itemsProcessed: results.processed,
          itemsFailed: results.errors
        })
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Batch processed, next batch scheduled as background task',
          results: {
            processed: results.processed,
            errors: results.errors,
            duration: Math.round((Date.now() - startTime) / 1000),
            nextBatch: batchNumber + 1
          }
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }
  } catch (error) {
    console.error('Worker error:', error)
    
    // Log detailed error information
    console.error('Worker error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      timestamp: new Date().toISOString(),
      runtime: Date.now() - startTime
    })
    
    if (logger) {
      try {
        await logger.complete(false, {}, error instanceof Error ? error : new Error('Unknown error'))
      } catch (logError) {
        console.error('Failed to log completion status:', logError)
      }
    }
    
    // Try to update job status if possible
    try {
      const requestData = await req.json().catch(() => ({}))
      const jobId = requestData.jobId
      
      if (jobId && supabase) {
        await failJob(jobId, error, supabase)
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError)
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        duration: Math.round((Date.now() - startTime) / 1000)
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})