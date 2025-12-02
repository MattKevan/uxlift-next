// /utils/post-tools/fetch-content.ts
import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { summarisePost } from './summarise'
import { tagPost } from './tag-posts'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { logger, logDatabaseQuery } from '@/utils/logger'

function validateAndFormatUrl(urlString: string): string {
  try {
    const url = new URL(urlString)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('URL must use HTTP or HTTPS protocol')
    }
    return url.toString()
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function fetchAndProcessContent(
  rawUrl: string, 
  supabase: SupabaseClient<Database>,
  options?: {
    user_id?: number;
    status?: string;
  }
) {
  try {
    logger.debug('Starting content fetch', { url: rawUrl })
    const validUrl = validateAndFormatUrl(rawUrl)

    // Define the select query properly
    const query = `
  id,
  title,
  description,
  content,
  image_path,
  link,
  date_created,
  date_published,
  status,
  indexed,
  summary,
  user_id,
  site_id,
  content_site!inner (
    id,
    title,
    url,
    feed_url,
    description,
    site_icon,
    include_in_newsfeed
  ),
  content_post_topics!inner (
    topic_id,
    content_topic!inner (
      id,
      name,
      slug
    )
  )
`

    // Check if URL already exists
    const { data: existingPost } = await supabase
      .from('content_post')
      .select(query)
      .eq('link', validUrl)
      .single()

    if (existingPost) {
      logger.debug('Post already exists in database', { url: validUrl, postId: existingPost.id })
      return existingPost
    }

    const response = await fetch(validUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UXLift/1.0; +https://uxlift.org)'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Extract metadata
    const title = $('meta[property="og:title"]').attr('content') || 
                 $('title').text() || 
                 $('meta[name="title"]').attr('content') || 
                 'Untitled'
    
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || 
                       ''
    
    const imagePath = $('meta[property="og:image"]').attr('content') || 
                     $('meta[property="twitter:image"]').attr('content') || 
                     null

    // Extract content using Readability
    let content = ''
    try {
      const dom = new JSDOM(html, {
        url: validUrl,
        // Don't load any external resources (CSS, images, fonts, etc.)
        resources: undefined,
        runScripts: 'outside-only',
        // Remove non-content elements before parsing to avoid errors and improve quality
        beforeParse(window) {
          const doc = window.document;

          // Elements that don't contribute to article content
          const selectorsToRemove = [
            'iframe',           // Embedded content (causes 403 errors)
            'script',           // JavaScript
            'style',            // CSS
            'link[rel="stylesheet"]', // External CSS (causes 404 errors)
            'noscript',         // Fallback content
            'video',            // Video embeds
            'audio',            // Audio embeds
            'object',           // Flash/embedded objects
            'embed',            // Other embedded content
            'nav',              // Navigation menus
            'header',           // Page headers
            'footer',           // Page footers
            'aside',            // Sidebars
            'form',             // Forms
            '[role="navigation"]',
            '[role="banner"]',
            '[role="contentinfo"]',
            '[role="complementary"]',
            '.advertisement',   // Common ad classes
            '.ad',
            '.ads',
            '.social-share',    // Social sharing widgets
            '.comments',        // Comment sections
            '#comments'
          ].join(',');

          const elementsToRemove = doc.querySelectorAll(selectorsToRemove);
          elementsToRemove.forEach(element => element.remove());
        }
      })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      content = article ? article.textContent : ''
    } catch (readabilityError) {
      logger.warn('Readability parsing failed, falling back to body text', readabilityError as Error)
      content = $('body').text().trim()
    }

    // Prepare post data
    const postData = {
      title: title.substring(0, 255),
      description: description.substring(0, 500),
      content,
      image_path: imagePath,
      link: validUrl,
      date_created: new Date().toISOString(),
      date_published: new Date().toISOString(),
      status: options?.status || 'draft',
      indexed: false,
      summary: '',
      user_id: options?.user_id || null
    } as const

    logger.debug('Creating new post', { userId: options?.user_id?.toString(), title: postData.title })

    // Create post
    const { data: post, error: postError } = await supabase
      .from('content_post')
      .insert([postData])
      .select()
      .single()

    if (postError) {
      if (postError.code === '23505') {
        const { data: existingPost, error: fetchError } = await supabase
          .from('content_post')
          .select('*')
          .eq('link', validUrl)
          .single()

        if (fetchError) {
          throw new Error(`Failed to fetch existing post: ${fetchError.message}`)
        }

        return existingPost
      }
      
      throw new Error(`Failed to insert post: ${postError.message}`)
    }

    if (!post) {
      throw new Error('Failed to create post: No data returned')
    }

    // Process the post
    try {
      await summarisePost(post.id, supabase)
      await tagPost(post.id, supabase)
    } catch (processingError) {
      logger.error('Post processing failed', processingError, { postId: post.id })
    }

    // Fetch final post with all relations
    const { data: finalPost, error: fetchError } = await supabase
      .from('content_post')
      .select(`
        id,
        title,
        description,
        content,
        image_path,
        link,
        date_created,
        date_published,
        status,
        indexed,
        summary,
        user_id,
        site_id
      `)
      .eq('id', post.id)
      .single()

    if (fetchError) {
      logger.error('Failed to fetch processed post', fetchError, { postId: post.id })
      throw fetchError
    }

    if (!finalPost) {
      throw new Error('Failed to fetch final post: No data returned')
    }

    return finalPost

  } catch (error) {
    logger.error('Content fetching failed', error, { url: rawUrl })
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to process content')
  }
}