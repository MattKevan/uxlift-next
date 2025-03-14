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
    console.log(`Initializing SimpleReadability for URL: ${baseUrl.substring(0, 50)}...`)
    try {
      const parser = new DOMParser();
      this.document = parser.parseFromString(html, 'text/html')!;
      
      if (!this.document) {
        console.error('Failed to parse HTML document')
        throw new Error('Failed to parse HTML document')
      }
      
      console.log('Document parsed successfully, extracting content')
      this.parse();
    } catch (parseError) {
      console.error('Error parsing HTML:', parseError)
      throw parseError
    }
  }

  private parse(): void {
    try {
      // Remove scripts, styles, and other non-content elements
      const elementsToRemove = [
        'script', 'style', 'iframe', 'form', 'button', 'input', 'nav',
        'footer', 'header', 'aside', 'noscript'
      ];

      for (const tag of elementsToRemove) {
        const elements = this.document.querySelectorAll(tag);
        console.log(`Removing ${elements.length} ${tag} elements`)
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
          console.log(`Found main content using selector: ${selector}`)
          mainContent = element;
          break;
        }
      }

      // If no main content found, use body
      if (!mainContent) {
        console.log('No main content found, using body')
        mainContent = this.document.body;
      }

      this.content = mainContent ? mainContent.textContent || '' : '';
      
      // Clean up the content
      this.content = this.content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
      
      console.log(`Extracted content length: ${this.content.length} characters`)
      if (this.content.length > 0) {
        console.log(`Content preview: ${this.content.substring(0, 100)}...`)
      } else {
        console.warn('Extracted content is empty')
      }
    } catch (parseError) {
      console.error('Error parsing content:', parseError)
      throw parseError
    }
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
  console.log('Starting content fetch for URL:', rawUrl)
  
  try {
    // Validate and format URL
    let validUrl;
    try {
      validUrl = validateAndFormatUrl(rawUrl)
      console.log('Validated URL:', validUrl)
    } catch (urlError) {
      console.error('URL validation error:', urlError)
      throw urlError
    }

    // Check if URL already exists
    try {
      console.log('Checking if URL already exists in database')
      const { data: existingPost, error: queryError } = await supabase
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

      if (queryError) {
        // If error is "not found", that's expected
        if (queryError.code !== 'PGRST116') {
          console.error('Error checking existing post:', queryError)
        }
      }

      if (existingPost) {
        console.log('Post already exists:', validUrl, 'Post ID:', existingPost.id)
        return existingPost
      }
    } catch (checkError) {
      console.error('Error checking for existing post:', checkError)
      // Continue processing even if check fails
    }

    // Fetch content from URL
    let response;
    try {
      console.log('Fetching content from URL:', validUrl)
      response = await fetch(validUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; UXLift/1.0; +https://uxlift.org)'
        }
      })

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      console.log(`Successfully fetched content, status: ${response.status}`)
    } catch (fetchError) {
      console.error('Error fetching URL:', fetchError)
      throw fetchError
    }

    // Process HTML content
    let html, $, title, description, imagePath, content;
    try {
      html = await response.text()
      console.log(`Received HTML content of length: ${html.length} bytes`)
      
      $ = load(html)
      console.log('Loaded HTML with cheerio')
      
      // Extract metadata
      title = $('meta[property="og:title"]').attr('content') || 
             $('title').text() || 
             $('meta[name="title"]').attr('content') || 
             'Untitled'
      
      console.log('Extracted title:', title)
      
      description = $('meta[property="og:description"]').attr('content') || 
                   $('meta[name="description"]').attr('content') || 
                   ''
      
      console.log('Extracted description:', description.substring(0, 100) + (description.length > 100 ? '...' : ''))
      
      imagePath = $('meta[property="og:image"]').attr('content') || 
                 $('meta[property="twitter:image"]').attr('content') || 
                 null
      
      console.log('Extracted image URL:', imagePath ? 'Found' : 'None')

      // Extract content using our simple Readability implementation
      try {
        console.log('Attempting to extract content using SimpleReadability')
        const reader = new SimpleReadability(html, validUrl)
        content = reader.getContent()
        
        // If content is too short, fallback to body text
        if (content.length < 100) {
          console.log(`Extracted content too short (${content.length} chars), falling back to body text`)
          content = $('body').text().trim()
          console.log(`Extracted body text of length: ${content.length} characters`)
        }
      } catch (readabilityError) {
        console.error('Readability error:', readabilityError)
        console.log('Falling back to body text')
        content = $('body').text().trim()
      }
      
      if (content.length === 0) {
        console.warn('No content extracted from URL')
      } else {
        console.log(`Extracted content length: ${content.length}, preview: ${content.substring(0, 100)}...`)
      }
    } catch (processError) {
      console.error('Error processing HTML content:', processError)
      throw processError
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

    console.log('Prepared post data:', {
      title: postData.title,
      descriptionLength: postData.description.length,
      contentLength: postData.content.length,
      status: postData.status,
      user_id: postData.user_id
    })

    // Create post
    let post;
    try {
      console.log('Inserting new post into database')
      const { data: newPost, error: postError } = await supabase
        .from('content_post')
        .insert([postData])
        .select()
        .single()

      if (postError) {
        // Check for unique constraint violation (post already exists)
        if (postError.code === '23505') {
          console.log('Duplicate post detected, fetching existing post')
          const { data: existingPost, error: fetchError } = await supabase
            .from('content_post')
            .select('*')
            .eq('link', validUrl)
            .single()

          if (fetchError) {
            console.error('Failed to fetch existing post:', fetchError)
            throw new Error(`Failed to fetch existing post: ${fetchError.message}`)
          }

          return existingPost
        }
        
        console.error('Failed to insert post:', postError)
        throw new Error(`Failed to insert post: ${postError.message}`)
      }

      if (!newPost) {
        console.error('Failed to create post: No data returned')
        throw new Error('Failed to create post: No data returned')
      }
      
      console.log('Successfully created post with ID:', newPost.id)
      post = newPost
    } catch (insertError) {
      console.error('Error inserting post:', insertError)
      throw insertError
    }

    // Process the post (summarize and tag)
    try {
      console.log(`Processing new post ${post.id} (summarize and tag)`)
      
      try {
        console.log(`Summarizing post ${post.id}`)
        const summaryResult = await summarisePost(post.id, supabase)
        
        if (summaryResult.success) {
          console.log(`Successfully summarized post ${post.id}:`, summaryResult.summary)
        } else {
          console.error(`Failed to summarize post ${post.id}:`, summaryResult.error, summaryResult.details)
        }
      } catch (summaryError) {
        console.error(`Error summarizing post ${post.id}:`, summaryError)
        // Continue processing even if summarization fails
      }
      
      try {
        console.log(`Tagging post ${post.id}`)
        const tagResult = await tagPost(post.id, supabase)
        
        if (tagResult.success) {
          console.log(`Successfully tagged post ${post.id} with topics:`, tagResult.suggestedTopics)
        } else {
          console.error(`Failed to tag post ${post.id}:`, tagResult.error, tagResult.details)
        }
      } catch (tagError) {
        console.error(`Error tagging post ${post.id}:`, tagError)
        // Continue processing even if tagging fails
      }
    } catch (processingError) {
      console.error('Post processing error:', processingError)
      // Continue without failing if post-processing errors occur
    }

    // Fetch final post with all relations
    try {
      console.log(`Fetching final post ${post.id} with relations`)
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
        console.error('Failed to fetch final post: No data returned')
        throw new Error('Failed to fetch final post: No data returned')
      }
      
      console.log(`Successfully fetched final post ${finalPost.id}`)
      return finalPost
    } catch (finalFetchError) {
      console.error('Error fetching final post:', finalFetchError)
      
      // Return the original post if we can't fetch the final post
      console.log('Returning original post as fallback')
      return post
    }

  } catch (error) {
    console.error('Content fetching error:', error, 'Stack:', error instanceof Error ? error.stack : undefined)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to process content')
  }
}