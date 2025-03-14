// supabase/functions/process-feeds-controller/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  // Log environment variables availability (without exposing the actual values)
  console.log('Environment check:', {
    supabaseUrl: Boolean(supabaseUrl),
    supabaseServiceKey: Boolean(supabaseServiceKey),
    openaiKey: Boolean(Deno.env.get('OPENAI_API_KEY')),
    pineconeApiKey: Boolean(Deno.env.get('PINECONE_API_KEY')),
    pineconeIndexName: Boolean(Deno.env.get('PINECONE_INDEX_NAME'))
  });
  
  // Create Supabase client with detailed error handling
  let supabase;
  try {
    supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    console.log('Supabase client created successfully');
  } catch (initError) {
    console.error('Failed to initialize Supabase client:', initError);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Supabase initialization failed',
        details: initError instanceof Error ? initError.message : 'Unknown error',
        stack: initError instanceof Error ? initError.stack : undefined
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
  
  // Initialize logger with detailed error handling
  let logger: EdgeFunctionLogger | null = null;
  try {
    logger = new EdgeFunctionLogger('process-feeds-controller');
    await logger.initialize();
    console.log('Logger initialized successfully with ID:', logger.logId);
  } catch (loggerError) {
    console.error('Failed to initialize logger:', loggerError);
    // Continue execution even if logger fails - we don't want logging issues to block the main functionality
  }
  
  try {
    if (logger) await logger.startStep('parse_request');
    let requestData;
    try {
      requestData = await req.json().catch(() => ({}));
      console.log('Request data parsed:', requestData);
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError);
      requestData = {};
    }
    
    const { jobId, isCron = true } = requestData;
    if (logger) await logger.endStep('parse_request', true, 'Request parsed successfully', { jobId, isCron });
    
    // Create or retrieve job
    if (logger) await logger.startStep('job_setup');
    let job;
    
    if (jobId) {
      // Get existing job
      try {
        const { data, error } = await supabase
          .from('feed_processing_jobs')
          .select('*')
          .eq('id', jobId)
          .single();
        
        if (error) {
          console.error(`Failed to retrieve job ${jobId}:`, error);
          throw new Error(`Failed to retrieve job: ${error.message}`);
        }
        
        if (!data) {
          console.error(`Job ${jobId} not found`);
          throw new Error(`Job ${jobId} not found`);
        }
        
        job = data;
        console.log(`Job ${jobId} retrieved:`, { status: job.status, currentBatch: job.current_batch });
      } catch (fetchJobError) {
        console.error('Error in job fetch:', fetchJobError);
        throw fetchJobError;
      }
    } else {
      // Check for already running job
      try {
        const { data: runningJobs, error: runningJobsError } = await supabase
          .from('feed_processing_jobs')
          .select('id, status, created_at')
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (runningJobsError) {
          console.error('Error checking for running jobs:', runningJobsError);
        }
        
        if (runningJobs && runningJobs.length > 0) {
          console.log('Found running job:', runningJobs[0]);
          if (logger) {
            await logger.endStep('job_setup', false, 'Another job is already running', { existingJobId: runningJobs[0].id });
            await logger.complete(false, {}, new Error('Another job is already running'));
          }
          
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Another job is already running',
              jobId: runningJobs[0].id,
              jobStatus: runningJobs[0].status,
              jobCreatedAt: runningJobs[0].created_at
            }),
            {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      } catch (runningJobsCheckError) {
        console.error('Error checking for running jobs:', runningJobsCheckError);
        // Continue execution - we'll create a new job even if we can't check for running ones
      }
      
      // Get count of sites to process
      if (logger) await logger.startStep('count_sites');
      let totalSites = 0;
      
      try {
        const { data: sites, error: sitesError } = await supabase
          .from('content_site')
          .select('id, title, feed_url')
          .eq('include_in_newsfeed', true)
          .not('feed_url', 'is', null);
        
        if (sitesError) {
          console.error('Failed to count sites:', sitesError);
          throw new Error(`Failed to count sites: ${sitesError.message}`);
        }
        
        totalSites = sites?.length || 0;
        console.log(`Found ${totalSites} sites to process with feeds:`, 
          sites?.slice(0, 3).map(s => ({ id: s.id, title: s.title })));
        
        if (logger) await logger.endStep('count_sites', true, `Found ${totalSites} sites to process`);
      } catch (sitesCountError) {
        console.error('Error counting sites:', sitesCountError);
        if (logger) await logger.endStep('count_sites', false, 'Failed to count sites', { error: sitesCountError.message });
        throw sitesCountError;
      }
      
      // Calculate batching
      const batchSize = 5; // Process 5 sites per batch
      const totalBatches = Math.ceil(totalSites / batchSize);
      console.log(`Calculated ${totalBatches} batches with batch size ${batchSize}`);
      
      // Create new job
      try {
        const { data: newJob, error: jobError } = await supabase
          .from('feed_processing_jobs')
          .insert([{
            status: 'pending',
            job_type: 'feed_processing',
            is_cron: isCron,
            total_sites: totalSites,
            batch_size: batchSize,
            total_batches: totalBatches,
            created_by: 'system', // This should be replaced with actual user ID if available
            metadata: {
              extensible: true,
              version: '1.0.0',
              controller_env: {
                deno_version: Deno.version.deno,
                typescript_version: Deno.version.typescript
              }
            }
          }])
          .select()
          .single();
        
        if (jobError) {
          console.error('Failed to create job:', jobError);
          throw new Error(`Failed to create job: ${jobError.message}`);
        }
        
        if (!newJob) {
          console.error('Failed to create job: No data returned');
          throw new Error('Failed to create job: No data returned');
        }
        
        job = newJob;
        console.log('Created new job:', { id: job.id, status: job.status });
      } catch (createJobError) {
        console.error('Error creating job:', createJobError);
        throw createJobError;
      }
    }
    
    if (logger) await logger.endStep('job_setup', true, 'Job setup completed', { jobId: job.id });
    
    // If job is pending, start it
    if (job.status === 'pending') {
      if (logger) await logger.startStep('start_job');
      
      // Update job status
      try {
        const { error: updateError } = await supabase
          .from('feed_processing_jobs')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
            last_updated: new Date().toISOString()
          })
          .eq('id', job.id);
        
        if (updateError) {
          console.error(`Failed to update job ${job.id} status:`, updateError);
          throw new Error(`Failed to update job: ${updateError.message}`);
        }
        
        console.log(`Updated job ${job.id} status to 'processing'`);
      } catch (updateJobError) {
        console.error('Error updating job status:', updateJobError);
        if (logger) await logger.endStep('start_job', false, 'Failed to update job status', { error: updateJobError.message });
        throw updateJobError;
      }
      
      // Invoke first worker
      if (logger) await logger.startStep('invoke_worker');
      
      try {
        const workerUrl = `${supabaseUrl}/functions/v1/process-feeds-worker`;
        console.log(`Invoking worker at ${workerUrl} for job ${job.id}, batch 0`);
        
        const workerResponse = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            jobId: job.id,
            batchNumber: 0
          })
        });
        
        if (!workerResponse.ok) {
          const errorText = await workerResponse.text().catch(() => 'Could not extract error details');
          console.error(`Worker invocation failed with status ${workerResponse.status}:`, errorText);
          throw new Error(`Worker invocation failed: ${workerResponse.status} ${errorText}`);
        }
        
        const workerResult = await workerResponse.json().catch(() => null);
        console.log('Worker invocation successful:', workerResult);
        
        if (logger) await logger.endStep('invoke_worker', true, 'Worker invoked successfully', { 
          batchNumber: 0, 
          responseStatus: workerResponse.status,
          responseBody: workerResult
        });
      } catch (workerInvokeError) {
        console.error('Error invoking worker:', workerInvokeError);
        if (logger) await logger.endStep('invoke_worker', false, 'Failed to invoke worker', { error: workerInvokeError.message });
        throw workerInvokeError;
      }
      
      if (logger) await logger.endStep('start_job', true, 'Job started successfully');
    } else {
      console.log(`Job ${job.id} is already in status '${job.status}', not starting`);
    }
    
    if (logger) await logger.complete(true, { itemsProcessed: 0 });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Feed processing initiated',
        jobId: job.id,
        jobStatus: job.status,
        totalSites: job.total_sites,
        totalBatches: job.total_batches
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Controller error:', error);
    
    // Log details about the error
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    if (logger) {
      try {
        await logger.complete(false, {}, error instanceof Error ? error : new Error('Unknown error'));
      } catch (logError) {
        console.error('Failed to log completion status:', logError);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
})