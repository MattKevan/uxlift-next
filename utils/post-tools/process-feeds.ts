// /utils/post-tools/process-feeds.ts
import Parser from 'rss-parser'
import type { Database } from '@/types/supabase'
import { createClient } from '@/utils/supabase/server'
import { fetchAndProcessContent } from './fetch-content'
import { summarisePost } from './summarise'
import { tagPost } from './tag-posts'
import { embedPost } from './embed-post'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>


type CustomItem = {
  title: string;
  link: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
}

type CustomFeed = {
  items: CustomItem[];
}

const parser: Parser<CustomFeed, CustomItem> = new Parser({
  customFields: {
    item: ['content', 'contentSnippet']
  }
})

// /utils/post-tools/process-feeds.ts

type ProgressCallback = (progress: {
  processed: number;
  errors: number;
  sites: number;
  currentSite: string;
}) => Promise<void>;

export async function processFeedItems(
  supabase: SupabaseClient,
  onProgress?: ProgressCallback
) {
  try {
    // Get all active sites with feeds
    const { data: sites, error: sitesError } = await supabase
      .from('content_site')
      .select('*')
      .eq('include_in_newsfeed', true)
      .not('feed_url', 'is', null)

    if (sitesError) throw sitesError

    const results = {
      processed: 0,
      errors: 0,
      sites: sites?.length || 0,
      currentSite: ''
    }

    // Process each site
    for (const site of sites || []) {
      try {
        if (!site.feed_url) continue

        results.currentSite = site.title || ''
        
        // Report progress
        if (onProgress) {
          await onProgress({
            ...results
          })
        }

        // Parse the RSS feed
        const feed = await parser.parseURL(site.feed_url)

        // Get all feed item links for batch processing
        const feedLinks = feed.items
          .map(item => item.link)
          .filter(link => link && link.trim())

        if (feedLinks.length === 0) continue

        // Single query to check all existing links (batch processing)
        const { data: existingPosts } = await supabase
          .from('content_post')
          .select('link')
          .in('link', feedLinks)

        const existingLinks = new Set(existingPosts?.map(p => p.link) || [])

        // Process only new items
        const newItems = feed.items.filter(item => 
          item.link && !existingLinks.has(item.link)
        )

        // Process each new feed item
        for (const item of newItems) {
          try {
            if (!item.link) continue

            // Process new article
            const newPost = await fetchAndProcessContent(item.link, supabase)
            
            if (newPost) {
              // Update the post with site_id and status
              const { error: updateError } = await supabase
                .from('content_post')
                .update({
                  site_id: site.id,
                  status: 'published',
                  date_published: item.pubDate || new Date().toISOString()
                })
                .eq('id', newPost.id)

              if (!updateError) {
                try {
                  // Summarize the post
                  await summarisePost(newPost.id, supabase)
                  
                  // Tag the post
                  await tagPost(newPost.id, supabase)

                  // Embed the post
                  await embedPost(newPost.id, supabase)
                  
                  results.processed++
                  
                  // Report progress after each successful item
                  if (onProgress) {
                    await onProgress({
                      ...results
                    })
                  }
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
      } catch (siteError) {
        results.errors++
        console.error(`Error processing site ${site.title}:`, siteError)
      }
    }

    return results

  } catch (error) {
    console.error('Feed processing error:', error)
    throw error
  }
}