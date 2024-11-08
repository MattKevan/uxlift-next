// /utils/post-tools/fetch-content.ts
import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { summarisePost } from './summarise'
import { tagPost } from './tag-posts'

function validateAndFormatUrl(urlString: string): string {
  const url = new URL(urlString)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('URL must use HTTP or HTTPS protocol')
  }
  return url.toString()
}

export async function fetchAndProcessContent(rawUrl: string, supabase: any) {
  try {
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
      content = $('body').text().trim()
    }

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
        status: 'draft',
        indexed: false,
        summary: ''
      })
      .select()
      .single()

    if (postError) {
      throw postError
    }

    // Process the post
    try {
      await summarisePost(post.id, supabase)
      await tagPost(post.id, supabase)
    } catch (processingError) {
      console.error('Processing error:', processingError)
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
      throw fetchError
    }

    return finalPost
  } catch (error) {
    console.error('Content fetching error:', error)
    throw error
  }
}
