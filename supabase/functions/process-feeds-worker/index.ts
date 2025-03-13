// supabase/functions/process-feeds-worker/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
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
  // Could save state or log progress here
})

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
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
  let logger: EdgeFunctionLogger | null = null
  
  try {
    // Parse request
    const { jobId, batchNumber } = await req.json()
    
    if (!jobId || batchNumber === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing jobId or batchNumber' }),
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
    logger = new EdgeFunctionLogger('process-feeds-worker', jobId)
    await logger.initialize()
    
    await logger.startStep('get_job_details')
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('feed_processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (jobError || !job) {
      await logger.endStep('get_job_details', false, 'Job not found')
      await logger.complete(false, {}, new Error('Job not found'))
      return new Response(
        JSON.stringify({ success: false, error: 'Job not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }
    await logger.endStep('get_job_details', true, 'Job details retrieved', { job })
    
    // Initialize parser
    await logger.startStep('initialize_parser')
    const parser = new Parser({
      customFields: {
        item: ['content', 'contentSnippet']
      }
    })
    await logger.endStep('initialize_parser', true, 'Parser initialized')
    
    // Get sites for this batch
    await logger.startStep('fetch_sites')
    const { data: sites, error: sitesError } = await supabase
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
      await logger.endStep('fetch_sites', false, 'Failed to fetch sites', { error: sitesError })
      throw new Error(`Failed to fetch sites: ${sitesError.message}`)
    }
    
    await logger.endStep('fetch_sites', true, `Fetched ${sites?.length || 0} sites for batch ${batchNumber}`)
    
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
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          await logger.startStep('time_limit_reached')
          await logger.endStep('time_limit_reached', true, 'Approaching time limit, stopping gracefully')
          // We need to stop and schedule the next batch
          break
        }
        
        if (!site.feed_url) continue
        
        results.currentSite = site.title || ''
        
        await logger.startStep(`process_site_${site.id}`)
        
        // Update job status
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
        
        // Parse the RSS feed
        await logger.startStep(`parse_feed_${site.id}`)
        let feed
        try {
          feed = await parser.parseURL(site.feed_url)
          await logger.endStep(`parse_feed_${site.id}`, true, `Parsed feed with ${feed.items.length} items`)
        } catch (feedError) {
          await logger.endStep(`parse_feed_${site.id}`, false, 'Failed to parse feed', { error: feedError })
          throw feedError
        }
        
        // Process each feed item
        for (const item of feed.items) {
          try {
            // Check time again
            if (Date.now() - startTime > MAX_EXECUTION_TIME) {
              break
            }
            
            if (!item.link) continue
            
            await logger.startStep(`check_item_${item.link.substring(0, 50)}`)
            
            // Check if article already exists
            const { data: existing } = await supabase
              .from('content_post')
              .select('id')
              .eq('link', item.link)
              .single()
            
            if (existing) {
              await logger.endStep(`check_item_${item.link.substring(0, 50)}`, true, 'Item already exists')
              continue
            }
            
            await logger.endStep(`check_item_${item.link.substring(0, 50)}`, true, 'Item is new, processing')
            
            // Process new article
            await logger.startStep(`fetch_content_${item.link.substring(0, 50)}`)
            const newPost = await fetchAndProcessContent(item.link, supabase)
            await logger.endStep(`fetch_content_${item.link.substring(0, 50)}`, Boolean(newPost), newPost ? 'Content fetched successfully' : 'Failed to fetch content')
            
            if (newPost) {
              // Update the post with site_id and status
              await logger.startStep(`update_post_${newPost.id}`)
              const { error: updateError } = await supabase
                .from('content_post')
                .update({
                  site_id: site.id,
                  status: 'published',
                  date_published: item.pubDate || new Date().toISOString()
                })
                .eq('id', newPost.id)
              
              if (updateError) {
                await logger.endStep(`update_post_${newPost.id}`, false, 'Failed to update post', { error: updateError })
              } else {
                await logger.endStep(`update_post_${newPost.id}`, true, 'Post updated successfully')
                
                try {
                  // Summarize the post
                  await logger.startStep(`summarize_post_${newPost.id}`)
                  const summaryResult = await summarisePost(newPost.id, supabase)
                  await logger.endStep(`summarize_post_${newPost.id}`, summaryResult.success, summaryResult.success ? 'Post summarized' : summaryResult.error)
                  
                  // Tag the post
                  await logger.startStep(`tag_post_${newPost.id}`)
                  const tagResult = await tagPost(newPost.id, supabase)
                  await logger.endStep(`tag_post_${newPost.id}`, tagResult.success, tagResult.success ? 'Post tagged' : tagResult.error)
                  
                  // Embed the post
                  await logger.startStep(`embed_post_${newPost.id}`)
                  const embedResult = await embedPost(newPost.id, supabase)
                  await logger.endStep(`embed_post_${newPost.id}`, embedResult.success, embedResult.success ? `Post embedded with ${embedResult.chunks} chunks` : embedResult.error)
                  
                  results.processed++
                  
                  // Create event for future extensions
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
                  
                } catch (processingError) {
                  console.error(`Error processing content for ${item.link}:`, processingError)
                  results.errors++
                }
              }
            }
          } catch (itemError) {
            console.error(`Error processing item from ${site.title}:`, itemError)
            results.errors++
          }
        }
        
        await logger.endStep(`process_site_${site.id}`, true, `Processed site with ${results.processed} new items`)
      } catch (siteError) {
        results.errors++
        console.error(`Error processing site ${site.title}:`, siteError)
        if (logger) {
          await logger.endStep(`process_site_${site.id}`, false, 'Failed to process site', { error: siteError })
        }
      }
    }
    
    // Update job with progress
    await logger.startStep('update_job_progress')
    const { data: updatedJob } = await supabase
      .from('feed_processing_jobs')
      .update({
        processed_sites: job.processed_sites + results.sites,
        processed_items: job.processed_items + results.processed,
        error_count: job.error_count + results.errors,
        last_updated: new Date().toISOString(),
        duration: job.duration ? job.duration + Math.round((Date.now() - startTime) / 1000) : Math.round((Date.now() - startTime) / 1000)
      })
      .eq('id', jobId)
      .select()
      .single()
    
    await logger.endStep('update_job_progress', true, 'Job progress updated', { 
      processed_sites: job.processed_sites + results.sites,
      processed_items: job.processed_items + results.processed,
      error_count: job.error_count + results.errors
    })
    
    // Determine if we need to process more batches
    const isLastBatch = batchNumber >= job.total_batches - 1
    const allSitesProcessed = sites && sites.length < job.batch_size
    
    if (isLastBatch || allSitesProcessed) {
      // Job is complete
      await logger.startStep('complete_job')
      await supabase
        .from('feed_processing_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      // Create completion event for future extensions
      await supabase
        .from('feed_processing_events')
        .insert([{
          job_id: jobId,
          event_type: 'job_completed',
          payload: {
            processed_items: updatedJob?.processed_items || 0,
            error_count: updatedJob?.error_count || 0
          }
        }])
      
      await logger.endStep('complete_job', true, 'Job completed successfully')
      await logger.complete(true, {
        itemsProcessed: results.processed,
        itemsFailed: results.errors
      })
      
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
      await logger.startStep('schedule_next_batch')
      
      // Define the background task for processing the next batch
      const processNextBatch = async () => {
        try {
          console.log(`Starting background processing of batch ${batchNumber + 1}`)
          
          // Process the next batch directly instead of making a new HTTP request
          const nextBatchResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-feeds-worker`, {
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
          
          console.log(`Completed background processing of batch ${batchNumber + 1}`)
        } catch (error) {
          console.error(`Error in background processing of batch ${batchNumber + 1}:`, error)
          
          // Update job status to failed if there's an error
          try {
            await supabase
              .from('feed_processing_jobs')
              .update({
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error in background processing',
                last_updated: new Date().toISOString()
              })
              .eq('id', jobId)
          } catch (updateError) {
            console.error('Failed to update job status after background error:', updateError)
          }
        }
      }
      
      // Use EdgeRuntime.waitUntil to run the next batch processing in the background
      EdgeRuntime.waitUntil(processNextBatch())
      
      await logger.endStep('schedule_next_batch', true, 'Next batch scheduled as background task', { nextBatch: batchNumber + 1 })
      await logger.complete(true, {
        itemsProcessed: results.processed,
        itemsFailed: results.errors
      })
      
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
    
    if (logger) {
      await logger.complete(false, {}, error instanceof Error ? error : new Error('Unknown error'))
    }
    
    // Try to update job status if possible
    try {
      const { jobId } = await req.json().catch(() => ({}))
      
      if (jobId) {
        await supabase
          .from('feed_processing_jobs')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            last_updated: new Date().toISOString()
          })
          .eq('id', jobId)
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError)
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
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