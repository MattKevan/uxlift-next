import Parser from 'rss-parser'
import type { Database } from '@/types/supabase'
import { createClient } from '@/utils/supabase/server'
import { fetchAndProcessContent } from './fetch-content'
import { summarisePost } from './summarise'
import { tagPost } from './tag-posts'

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

export async function processFeedItems(supabase: SupabaseClient) {
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
    }

    // Process each site
    for (const site of sites || []) {
      try {
        if (!site.feed_url) continue

        // Parse the RSS feed
        const feed = await parser.parseURL(site.feed_url)

        // Process each feed item
        for (const item of feed.items) {
          try {
            if (!item.link) continue

            // Check if article already exists
            const { data: existing } = await supabase
              .from('content_post')
              .select('id')
              .eq('link', item.link)
              .single()

            if (existing) continue

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
                  
                  results.processed++
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
        console.error(`Error processing site ${site.title}:`, siteError)
        results.errors++
      }
    }

    return {
      success: true,
      ...results
    }
  } catch (error) {
    console.error('Feed processing error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
