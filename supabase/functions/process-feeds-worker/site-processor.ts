// supabase/functions/process-feeds-worker/site-processor.ts
import { Parser } from 'npm:rss-parser@3.13.0'
import { EdgeFunctionLogger } from '../_shared/logger.ts'
import { updateJobSiteStatus } from './job-manager.ts'
import { processFeedItem } from './post-processor.ts'

// Process a batch of sites
export async function processSiteBatch(
  job: any,
  batchNumber: number,
  supabase: any,
  logger: EdgeFunctionLogger | null,
  startTime: number,
  maxExecutionTime: number
) {
  // Initialize parser
  if (logger) await logger.startStep('initialize_parser')
  const parser = await initializeParser(logger)
  
  // Get sites for this batch
  if (logger) await logger.startStep('fetch_sites')
  const sites = await fetchSites(job, batchNumber, supabase, logger)
  if (logger) await logger.endStep('fetch_sites', true, `Fetched ${sites.length} sites for batch ${batchNumber}`)
  
  const results = {
    processed: 0,
    errors: 0,
    sites: sites.length,
    currentSite: ''
  }
  
  // Process each site in the batch
  for (const site of sites) {
    try {
      // Check if we're approaching time limit
      const elapsedTime = Date.now() - startTime
      if (elapsedTime > maxExecutionTime) {
        console.log(`Approaching time limit after ${elapsedTime}ms, stopping gracefully`)
        if (logger) {
          await logger.startStep('time_limit_reached')
          await logger.endStep('time_limit_reached', true, 'Approaching time limit, stopping gracefully', 
            { elapsedTime, limit: maxExecutionTime })
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
      await updateJobSiteStatus(job.id, batchNumber, results.currentSite, site.id, supabase)
      
      // Parse the RSS feed
      if (logger) await logger.startStep(`parse_feed_${site.id}`)
      const feed = await parseFeed(site, logger)
      
      if (!feed) {
        results.errors++
        continue // Skip to next site
      }
      
      // Process feed items
      const siteResults = await processFeedItems(
        feed, 
        site, 
        job.id, 
        supabase, 
        logger, 
        startTime, 
        maxExecutionTime
      )
      
      results.processed += siteResults.processed
      results.errors += siteResults.errors
      
      console.log(`Completed processing site ${site.id} (${site.title}): ${siteResults.processed} items processed, ${siteResults.errors} errors`)
      if (logger) await logger.endStep(`process_site_${site.id}`, true, `Processed site with ${siteResults.processed} new items`, {
        siteId: site.id,
        siteTitle: site.title,
        processedItems: siteResults.processed,
        errors: siteResults.errors,
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
  
  return results
}

// Initialize RSS parser
async function initializeParser(logger: EdgeFunctionLogger | null) {
  try {
    const parser = new Parser({
      customFields: {
        item: ['content', 'contentSnippet']
      }
    })
    console.log('RSS parser initialized')
    if (logger) await logger.endStep('initialize_parser', true, 'Parser initialized')
    return parser
  } catch (parserError) {
    console.error('Failed to initialize RSS parser:', parserError)
    if (logger) await logger.endStep('initialize_parser', false, 'Failed to initialize parser', 
      { error: parserError instanceof Error ? parserError.message : 'Unknown error' })
    throw parserError
  }
}

// Fetch sites for a batch
async function fetchSites(job: any, batchNumber: number, supabase: any, logger: EdgeFunctionLogger | null) {
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
    
    const sites = data || []
    console.log(`Fetched ${sites.length} sites for batch ${batchNumber}:`, 
      sites.slice(0, 3).map((s: any) => ({ id: s.id, title: s.title })))
    
    return sites
  } catch (sitesError) {
    console.error('Error fetching sites:', sitesError)
    if (logger) await logger.endStep('fetch_sites', false, 'Failed to fetch sites', 
      { error: sitesError instanceof Error ? sitesError.message : 'Unknown error' })
    throw sitesError
  }
}

// Parse RSS feed
async function parseFeed(site: any, logger: EdgeFunctionLogger | null) {
  try {
    console.log(`Parsing feed: ${site.feed_url}`)
    const parser = new Parser({
      customFields: {
        item: ['content', 'contentSnippet']
      }
    })
    const feed = await parser.parseURL(site.feed_url)
    console.log(`Successfully parsed feed with ${feed.items.length} items`)
    
    if (logger) await logger.endStep(`parse_feed_${site.id}`, true, 
      `Parsed feed with ${feed.items.length} items`, {
        feedTitle: feed.title,
        feedDescription: feed.description?.substring(0, 100),
        itemCount: feed.items.length
      })
    
    return feed
  } catch (feedError) {
    console.error(`Error parsing feed for site ${site.id} (${site.title}):`, feedError)
    
    if (logger) await logger.endStep(`parse_feed_${site.id}`, false, 'Failed to parse feed', 
      { error: feedError instanceof Error ? feedError.message : 'Unknown error', url: site.feed_url })
    
    return null
  }
}

// Process feed items
async function processFeedItems(
  feed: any, 
  site: any, 
  jobId: number,
  supabase: any,
  logger: EdgeFunctionLogger | null,
  startTime: number,
  maxExecutionTime: number
) {
  let processed = 0
  let errors = 0
  
  for (const item of feed.items) {
    try {
      // Check time again
      if (Date.now() - startTime > maxExecutionTime) {
        console.log(`Time limit reached while processing feed items, stopping`)
        break
      }
      
      if (!item.link) {
        console.log('Skipping item - no link provided')
        continue
      }
      
      // Process the item
      const result = await processFeedItem(item, site, jobId, supabase, logger)
      
      if (result.success) {
        processed++
      } else {
        errors++
      }
    } catch (itemError) {
      console.error(`Error processing item from ${site.title}:`, itemError)
      errors++
    }
  }
  
  return { processed, errors }
}