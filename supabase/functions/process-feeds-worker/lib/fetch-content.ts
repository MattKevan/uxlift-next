// supabase/functions/process-feeds-worker/lib/fetch-content.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'
import { load } from 'npm:cheerio@1.0.0'
import { summarisePost } from './summarise.ts'
import { tagPost } from './tag-posts.ts'

// Type definitions
type SupabaseClient = ReturnType<typeof createClient>

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

// Simple Readability-like implementation for Deno
class SimpleReadability {
  private document: Document;
  private content: string = '';

  constructor(html: string, baseUrl: string) {
    const parser = new DOMParser();
    this.document = parser.parseFromString(html, 'text/html')!;
    this.parse();
  }

  private parse(): void {
    // Remove scripts, styles, and other non-content elements
    const elementsToRemove = [
      'script', 'style', 'iframe', 'form', 'button', 'input', 'nav',
      'footer', 'header', 'aside', 'noscript'
    ];

    for (const tag of elementsToRemove) {
      const elements = this.document.querySelectorAll(tag);
      for (const el of elements) {
        el.parentNode?.removeChild(el);
      }
    }

    // Try to find the main content
    const possibleContentSelectors = [
      'article', 'main', '.content', '.post', '.article', '.post-content',
      '#content', '#main', '.main', '[role="main"]'
    ];

    let mainContent = null;
    for (const selector of possibleContentSelectors) {
      const element = this.document.querySelector(selector);
      if (element) {
        mainContent = element;
        break;
      }
    }

    // If no main content found, use body
    if (!mainContent) {
      mainContent = this.document.body;
    }

    this.content = mainContent ? mainContent.textContent || '' : '';
    
    // Clean up the content
    this.content = this.content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  getContent(): string {
    return this.content;
  }
}

export async function fetchAndProcessContent(
  rawUrl: string, 
  supabase: SupabaseClient,
  options?: {
    user_id?: number;
    status?: string;
  }
) {
  try {
    console.log('Starting content fetch for URL:', rawUrl)
    const validUrl = validateAndFormatUrl(rawUrl)

    // Check if URL already exists
    const { data: existingPost } = await supabase
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
    const $ = load(html)
    
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

    // Extract content using our simple Readability implementation
    let content = ''
    try {
      const reader = new SimpleReadability(html, validUrl)
      content = reader.getContent()
      
      // If content is too short, fallback to body text
      if (content.length < 100) {
        content = $('body').text().trim()
      }
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
    }

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