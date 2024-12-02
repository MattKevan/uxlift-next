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
      console.log('Post already exists:', validUrl)
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
      const dom = new JSDOM(html, { url: validUrl })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      content = article ? article.textContent : ''
    } catch (readabilityError) {
      console.error('Readability error:', readabilityError)
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

    console.log('Attempting to insert post with user_id:', options?.user_id)

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
      console.error('Post processing error:', processingError)
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
      console.error('Final post fetch error:', fetchError)
      throw fetchError
    }

    if (!finalPost) {
      throw new Error('Failed to fetch final post: No data returned')
    }

    return finalPost

  } catch (error) {
    console.error('Content fetching error:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to process content')
  }
}