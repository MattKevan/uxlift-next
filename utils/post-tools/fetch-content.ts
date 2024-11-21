// /utils/post-tools/fetch-content.ts
import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { summarisePost } from './summarise'
import { tagPost } from './tag-posts'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

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
    console.log('Starting content fetch for URL:', rawUrl)
    const validUrl = validateAndFormatUrl(rawUrl)

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
      const dom = new JSDOM(html, { url: validUrl })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      content = article ? article.textContent : ''
    } catch (readabilityError) {
      console.error('Readability error:', readabilityError)
      content = $('body').text().trim()
    }

    console.log('Attempting to insert post with user_id:', options?.user_id)

    // Create post
    const { data: post, error: postError } = await supabase
      .from('content_post')
      .insert({
        title: title.substring(0, 255),
        description: description.substring(0, 500),
        content: content,
        image_path: imagePath,
        link: validUrl,
        date_created: new Date().toISOString(),
        date_published: new Date().toISOString(),
        status: options?.status || 'draft',
        indexed: false,
        summary: '',
        user_id: options?.user_id || null
      })
      .select()
      .single()

    if (postError) {
      console.error('Post insertion error:', postError)
      throw postError
    }

    // Process the post
    try {
      await summarisePost(post.id, supabase)
      await tagPost(post.id, supabase)
    } catch (processingError) {
      console.error('Post processing error:', processingError)
      // Continue despite processing errors
    }

    // Fetch final post
    const { data: finalPost, error: fetchError } = await supabase
      .from('content_post')
      .select(`
        *,
        content_post_topics (
          content_topic (
            id,
            name,
            slug
          )
        )
      `)
      .eq('id', post.id)
      .single()

    if (fetchError) {
      console.error('Final post fetch error:', fetchError)
      throw fetchError
    }

    return finalPost
  } catch (error) {
    console.error('Content fetching error:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to process content')
  }
}
