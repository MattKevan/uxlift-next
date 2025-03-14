// supabase/functions/process-feeds-worker/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { Parser } from 'npm:rss-parser@3.13.0'
import { EdgeFunctionLogger } from '../_shared/logger.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Import adapted versions of processing functions
import { fetchAndProcessContent } from './lib/fetch-content.ts'
import { summarisePost } from './lib/summarise.ts'
import { tagPost } from './lib/tag-posts.ts'
import { embedPost } from './lib/embed-post.ts'

// Maximum execution time (slightly under the 60s limit)
const MAX_EXECUTION_TIME = 55 * 1000 // 55 seconds

// Listen for shutdown events
addEventListener('beforeunload', (ev) => {
  console.log('Function will be shutdown due to', ev.detail?.reason)
  // Save state or log progress information here if needed
})

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  
  // Log environment availability
  console.log('Environment check:', {
    supabaseUrl: Boolean(Deno.env.get('SUPABASE_URL')),
    supabaseServiceKey: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
    openaiKey: Boolean(Deno.env.get('OPENAI_API_KEY')),
    pineconeApiKey: Boolean(Deno.env.get('PINECONE_API_KEY')),
    pineconeIndexName: Boolean(Deno.env.get('PINECONE_INDEX_NAME'))
  })
  
  // Initialize Supabase client with error handling
  let supabase;
  try {
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
  } catch (initError) {
    console.error('Failed to initialize Supabase client:', initError)
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
    )
  }
  
  let logger: EdgeFunctionLogger | null = null
  
  try {
    // Parse request with detailed error handling
    let requestData;
    try {
      requestData = await req.json()
      console.log('Request data:', requestData)
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
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
    
    // Initialize logger with job ID
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
    let job;
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
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Job not found',
            details: jobError ? jobError.message : 'No data returned'
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        )
      }
      
      job = data
      console.log(`Job ${jobId} details:`, {
        status: job.status,
        currentBatch: job.current_batch,
        totalBatches: job.total_batches,
        processedItems: job.processed_items
      })
      
      if (logger) await logger.endStep('get_job_details', true, 'Job details retrieved', { job })
    } catch (fetchJobError) {
      console.error('Error fetching job details:', fetchJobError)
      if (logger) {
        await logger.endStep('get_job_details', false, 'Error fetching job details', 
          { error: fetchJobError instanceof Error ? fetchJobError.message : 'Unknown error' })
        await logger.complete(false, {}, fetchJobError instanceof Error ? fetchJobError : new Error('Unknown error'))
      }
      throw fetchJobError
    }
    
    // Initialize parser
    if (logger) await logger.startStep('initialize_parser')
    let parser;
    try {
      parser = new Parser({
        customFields: {
          item: ['content', 'contentSnippet']
        }
      })
      console.log('RSS parser initialized')
      if (logger) await logger.endStep('initialize_parser', true, 'Parser initialized')
    } catch (parserError) {
      console.error('Failed to initialize RSS parser:', parserError)
      if (logger) await logger.endStep('initialize_parser', false, 'Failed to initialize parser', 
        { error: parserError instanceof Error ? parserError.message : 'Unknown error' })
      throw parserError
    }
    
    // Get sites for this batch
    if (logger) await logger.startStep('fetch_sites')
    let sites;
    try {
      const { data, error: sitesError } = await supabase
        .from('content_site')
        .select('*')
        .eq('include_in_newsfeed', true)
        .not('feed_url', 'is', null)
        .order('id', { ascending: true })
        .range(
          batchNumber * job.batch_size, 
          (batchNumber + 1) * job.batch_size - 1
        )
      
      if (sitesError) {
        console.error('Failed to fetch sites:', sitesError)
        if (logger) await logger.endStep('fetch_sites', false, 'Failed to fetch sites', { error: sitesError })
        throw new Error(`Failed to fetch sites: ${sitesError.message}`)
      }
      
      sites = data || []
      console.log(`Fetched ${sites.length} sites for batch ${batchNumber}:`, 
        sites.slice(0, 3).map(s => ({ id: s.id, title: s.title })))
      
      if (logger) await logger.endStep('fetch_sites', true, `Fetched ${sites.length} sites for batch ${batchNumber}`)
    } catch (sitesError) {
      console.error('Error fetching sites:', sitesError)
      if (logger) await logger.endStep('fetch_sites', false, 'Failed to fetch sites', 
        { error: sitesError instanceof Error ? sitesError.message : 'Unknown error' })
      throw sitesError
    }
    
    const results = {
      processed: 0,
      errors: 0,
      sites: sites?.length || 0,
      currentSite: ''
    }
    
    // Process each site in the batch
    for (const site of sites || []) {
      try {
        // Check if we're approaching time limit
        const elapsedTime = Date.now() - startTime
        if (elapsedTime > MAX_EXECUTION_TIME) {
          console.log(`Approaching time limit after ${elapsedTime}ms, stopping gracefully`)
          if (logger) {
            await logger.startStep('time_limit_reached')
            await logger.endStep('time_limit_reached', true, 'Approaching time limit, stopping gracefully', 
              { elapsedTime, limit: MAX_EXECUTION_TIME })
          }
          // We need to stop and schedule the next batch
          break
        }
        
        if (!site.feed_url) {
          console.log(`Skipping site ${site.id} (${site.title}) - no feed URL`)
          continue
        }
        
        results.currentSite = site.title || ''
        console.log(`Processing site: ${site.id} (${results.currentSite})`)
        
        if (logger) await logger.startStep(`process_site_${site.id}`)
        
        // Update job status
        try {
          await supabase
            .from('feed_processing_jobs')
            .update({
              status: 'processing',
              current_batch: batchNumber,
              current_site: results.currentSite,
              last_processed_site_id: site.id,
              last_updated: new Date().toISOString()
            })
            .eq('id', jobId)
          
          console.log(`Updated job ${jobId} status with current site: ${results.currentSite}`)
        } catch (updateError) {
          console.error(`Failed to update job ${jobId} status:`, updateError)
          // Continue processing even if update fails
        }
        
        // Parse the RSS feed
        if (logger) await logger.startStep(`parse_feed_${site.id}`)
        let feed;
        
        try {
          console.log(`Parsing feed: ${site.feed_url}`)
          feed = await parser.parseURL(site.feed_url)
                      console.log(`Successfully parsed feed with ${feed.items.length} items`)
          
          if (logger) await logger.endStep(`parse_feed_${site.id}`, true, 
            `Parsed feed with ${feed.items.length} items`, {
              feedTitle: feed.title,
              feedDescription: feed.description?.substring(0, 100),
              itemCount: feed.items.length
            })
        } catch (feedError) {
          console.error(`Error parsing feed for site ${site.id} (${site.title}):`, feedError)
          
          if (logger) await logger.endStep(`parse_feed_${site.id}`, false, 'Failed to parse feed', 
            { error: feedError instanceof Error ? feedError.message : 'Unknown error', url: site.feed_url })
          
          results.errors++
          continue // Skip to next site
        }
        
        // Process each feed item
        let siteTotalProcessed = 0
        let siteTotalErrors = 0
        
        for (const item of feed.items) {
          try {
            // Check time again
            if (Date.now() - startTime > MAX_EXECUTION_TIME) {
              console.log(`Time limit reached while processing feed items, stopping`)
              break
            }
            
            if (!item.link) {
              console.log('Skipping item - no link provided')
              continue
            }
            
            // Truncate link for logging purposes
            const truncatedLink = item.link.length > 50 
              ? item.link.substring(0, 47) + '...' 
              : item.link
            
            const stepName = `check_item_${truncatedLink.replace(/[^a-zA-Z0-9]/g, '_')}`
            
            if (logger) await logger.startStep(stepName)
            console.log(`Checking item: ${truncatedLink}`)
            
            // Check if article already exists
            try {
              const { data: existing } = await supabase
                .from('content_post')
                .select('id')
                .eq('link', item.link)
                .single()
              
              if (existing) {
                console.log(`Item already exists: ${truncatedLink} (ID: ${existing.id})`)
                if (logger) await logger.endStep(stepName, true, 'Item already exists', { postId: existing.id })
                continue
              }
            } catch (checkError) {
              // If error is "not found", that's expected - continue processing
              if (checkError.code !== 'PGRST116') {
                console.error(`Error checking existing post for ${truncatedLink}:`, checkError)
              }
            }
            
            console.log(`Item is new, processing: ${truncatedLink}`)
            if (logger) await logger.endStep(stepName, true, 'Item is new, processing')
            
            // Process new article
            const fetchStepName = `fetch_content_${truncatedLink.replace(/[^a-zA-Z0-9]/g, '_')}`
            if (logger) await logger.startStep(fetchStepName)
            
            let newPost;
            try {
              console.log(`Fetching content from: ${item.link}`)
              newPost = await fetchAndProcessContent(item.link, supabase)
              
              if (newPost) {
                console.log(`Content fetched successfully, created post ID: ${newPost.id}`)
                if (logger) await logger.endStep(fetchStepName, true, 'Content fetched successfully', 
                  { postId: newPost.id, title: newPost.title })
              } else {
                console.error(`Failed to fetch content from ${item.link} - no post created`)
                if (logger) await logger.endStep(fetchStepName, false, 'Failed to fetch content')
                siteTotalErrors++
                continue
              }
            } catch (fetchError) {
              console.error(`Error fetching content from ${item.link}:`, fetchError)
              if (logger) await logger.endStep(fetchStepName, false, 'Error fetching content', 
                { error: fetchError instanceof Error ? fetchError.message : 'Unknown error' })
              siteTotalErrors++
              continue
            }
            
            // Update the post with site_id and status
            const updateStepName = `update_post_${newPost.id}`
            if (logger) await logger.startStep(updateStepName)
            
            try {
              const { error: updateError } = await supabase
                .from('content_post')
                .update({
                  site_id: site.id,
                  status: 'published',
                  date_published: item.pubDate || new Date().toISOString()
                })
                .eq('id', newPost.id)
              
              if (updateError) {
                console.error(`Failed to update post ${newPost.id}:`, updateError)
                if (logger) await logger.endStep(updateStepName, false, 'Failed to update post', 
                  { error: updateError.message })
                siteTotalErrors++
                continue
              }
              
              console.log(`Updated post ${newPost.id} with site ID and status`)
              if (logger) await logger.endStep(updateStepName, true, 'Post updated successfully')
            } catch (updateError) {
              console.error(`Error updating post ${newPost.id}:`, updateError)
              if (logger) await logger.endStep(updateStepName, false, 'Error updating post', 
                { error: updateError instanceof Error ? updateError.message : 'Unknown error' })
              siteTotalErrors++
              continue
            }
            
            // Process the post (summarize, tag, embed)
            try {
              // Summarize the post
              const summarizeStepName = `summarize_post_${newPost.id}`
              if (logger) await logger.startStep(summarizeStepName)
              
              console.log(`Summarizing post ${newPost.id}`)
              try {
                const summaryResult = await summarisePost(newPost.id, supabase)
                
                if (summaryResult.success) {
                  console.log(`Post ${newPost.id} successfully summarized: "${summaryResult.summary?.substring(0, 50)}..."`)
                  if (logger) await logger.endStep(summarizeStepName, true, 'Post summarized')
                } else {
                  console.error(`Failed to summarize post ${newPost.id}:`, summaryResult.error, summaryResult.details)
                  if (logger) await logger.endStep(summarizeStepName, false, summaryResult.error || 'Unknown error', 
                    { details: summaryResult.details })
                }
                
                // Tag the post
                const tagStepName = `tag_post_${newPost.id}`
                if (logger) await logger.startStep(tagStepName)
                
                console.log(`Tagging post ${newPost.id}`)
                try {
                  const tagResult = await tagPost(newPost.id, supabase)
                  
                  if (tagResult.success) {
                    console.log(`Post ${newPost.id} successfully tagged with topics:`, 
                      tagResult.suggestedTopics?.join(', ') || 'none')
                    if (logger) await logger.endStep(tagStepName, true, 'Post tagged', 
                      { topics: tagResult.suggestedTopics })
                  } else {
                    console.error(`Failed to tag post ${newPost.id}:`, tagResult.error, tagResult.details)
                    if (logger) await logger.endStep(tagStepName, false, tagResult.error || 'Unknown error', 
                      { details: tagResult.details })
                  }
                } catch (tagError) {
                  console.error(`Error tagging post ${newPost.id}:`, tagError)
                  if (logger) await logger.endStep(tagStepName, false, 'Error tagging post', 
                    { error: tagError instanceof Error ? tagError.message : 'Unknown error' })
                }
                
                // Embed the post
                const embedStepName = `embed_post_${newPost.id}`
                if (logger) await logger.startStep(embedStepName)
                
                console.log(`Embedding post ${newPost.id}`)
                try {
                  const embedResult = await embedPost(newPost.id, supabase)
                  
                  if (embedResult.success) {
                    console.log(`Post ${newPost.id} successfully embedded with ${embedResult.chunks} chunks`)
                    if (logger) await logger.endStep(embedStepName, true, 
                      `Post embedded with ${embedResult.chunks} chunks`)
                  } else {
                    console.error(`Failed to embed post ${newPost.id}:`, embedResult.error, embedResult.details)
                    if (logger) await logger.endStep(embedStepName, false, embedResult.error || 'Unknown error', 
                      { details: embedResult.details })
                  }
                } catch (embedError) {
                  console.error(`Error embedding post ${newPost.id}:`, embedError)
                  if (logger) await logger.endStep(embedStepName, false, 'Error embedding post', 
                    { error: embedError instanceof Error ? embedError.message : 'Unknown error' })
                }
                Looking at the truncated code you provided, I can see it's the enhanced version of the `process-feeds-worker/index.ts` file that I created earlier.

                Let me provide you with the most likely missing parts to complete this file:

                                
                try {
                  // Create event for successful post processing
                  await supabase
                    .from('feed_processing_events')
                    .insert([{
                      job_id: jobId,
                      event_type: 'post_processed',
                      payload: {
                        post_id: newPost.id,
                        site_id: site.id,
                        title: newPost.title,
                        link: newPost.link
                      }
                    }])
                  
                  results.processed++
                  siteTotalProcessed++
                  console.log(`Post ${newPost.id} processing complete`)
                } catch (eventError) {
                  console.error(`Error creating processing event for post ${newPost.id}:`, eventError)
                  // Continue processing even if event creation fails
                }
              } catch (processingError) {
                console.error(`Error processing content for ${item.link}:`, processingError)
                if (logger) {
                  // Log detailed error information
                  await logger.startStep(`processing_error_${newPost.id}`)
                  await logger.endStep(`processing_error_${newPost.id}`, false, 'Content processing failed', {
                    error: processingError instanceof Error ? processingError.message : 'Unknown error',
                    stack: processingError instanceof Error ? processingError.stack : undefined,
                    postId: newPost.id,
                    link: item.link
                  })
                }
                results.errors++
                siteTotalErrors++
              }
            }
          } catch (itemError) {
            console.error(`Error processing item from ${site.title}:`, itemError)
            results.errors++
            siteTotalErrors++
          }
        }
        
        console.log(`Completed processing site ${site.id} (${site.title}): ${siteTotalProcessed} items processed, ${siteTotalErrors} errors`)
        if (logger) await logger.endStep(`process_site_${site.id}`, true, `Processed site with ${siteTotalProcessed} new items`, {
          siteId: site.id,
          siteTitle: site.title,
          processedItems: siteTotalProcessed,
          errors: siteTotalErrors,
          elapsedTime: Date.now() - startTime
        })
      } catch (siteError) {
        results.errors++
        console.error(`Error processing site ${site.title}:`, siteError)
        if (logger) {
          await logger.endStep(`process_site_${site.id}`, false, 'Failed to process site', { 
            error: siteError instanceof Error ? siteError.message : 'Unknown error',
            stack: siteError instanceof Error ? siteError.stack : undefined,
            siteId: site.id,
            siteTitle: site.title,
            siteFeedUrl: site.feed_url
          })
        }
      }
    }
    
    // Update job with progress
    if (logger) await logger.startStep('update_job_progress')
    
    let updatedJob;
    try {
      console.log(`Updating job ${jobId} progress:`, {
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
        .eq('id', jobId)
        .select()
        .single()
      
      if (updateError) {
        console.error(`Failed to update job ${jobId} progress:`, updateError)
        if (logger) await logger.endStep('update_job_progress', false, 'Failed to update job progress', 
          { error: updateError.message })
      } else {
        updatedJob = data
        console.log(`Successfully updated job ${jobId} progress`)
        if (logger) await logger.endStep('update_job_progress', true, 'Job progress updated', { 
          processed_sites: job.processed_sites + results.sites,
          processed_items: job.processed_items + results.processed,
          error_count: job.error_count + results.errors,
          duration: updatedJob.duration
        })
      }
    } catch (updateJobError) {
      console.error('Error updating job progress:', updateJobError)
      if (logger) await logger.endStep('update_job_progress', false, 'Error updating job progress', 
        { error: updateJobError instanceof Error ? updateJobError.message : 'Unknown error' })
    }
    
    // Determine if we need to process more batches
    const isLastBatch = batchNumber >= job.total_batches - 1
    const allSitesProcessed = sites && sites.length < job.batch_size
    
    console.log('Determining next steps:', {
      batchNumber,
      totalBatches: job.total_batches,
      isLastBatch,
      sitesInBatch: sites?.length,
      batchSize: job.batch_size,
      allSitesProcessed,
      elapsedTime: Date.now() - startTime
    })
    
    if (isLastBatch || allSitesProcessed) {
      // Job is complete
      if (logger) await logger.startStep('complete_job')
      
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
      } catch (completeJobError) {
        console.error(`Error marking job ${jobId} as completed:`, completeJobError)
        if (logger) await logger.endStep('complete_job', false, 'Error marking job as completed', 
          { error: completeJobError instanceof Error ? completeJobError.message : 'Unknown error' })
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
              processed_items: job.processed_items + results.processed,
              error_count: job.error_count + results.errors,
              duration: Date.now() - startTime,
              completed_at: new Date().toISOString()
            }
          }])
          
        console.log(`Successfully created completion event for job ${jobId}`)
      } catch (eventError) {
        console.error(`Error creating completion event for job ${jobId}:`, eventError)
        // Continue even if event creation fails
      }
      
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
      // Schedule next batch as a background task
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
          try {
            console.log(`Marking job ${jobId} as failed due to background processing error`)
            await supabase
              .from('feed_processing_jobs')
              .update({
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error in background processing',
                last_updated: new Date().toISOString()
              })
              .eq('id', jobId)
          } catch (updateError) {
            console.error(`Failed to update job ${jobId} status after background error:`, updateError)
          }
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
      
      if (jobId) {
        console.log(`Updating job ${jobId} status to failed`)
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
