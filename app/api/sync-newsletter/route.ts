import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const headersList = headers()
    const supabase = await createClient()

    let imported = 0
    let skipped = 0
    let page = 1
    let hasMorePages = true

    while (hasMorePages) {
      console.log(`Fetching page ${page}...`)
      
      // Get list of posts with content included
      const listResponse = await fetch(
        `https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUBLICATION_ID}/posts?page=${page}&limit=100&expand=free_web_content`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}`,
            'Accept': 'application/json',
          },
        }
      )

      if (!listResponse.ok) {
        const errorText = await listResponse.text()
        console.error('API Error:', errorText)
        throw new Error('Failed to fetch posts list from Beehiiv')
      }

      const listData = await listResponse.json()
      console.log(`Found ${listData.data.length} posts on page ${page}`)
      
      // Log the first post's complete structure to see what we're getting
      if (listData.data[0]) {
        console.log('First post complete structure:', JSON.stringify(listData.data[0], null, 2))
      }

      for (const post of listData.data) {
        console.log('Processing post:', {
          id: post.id,
          title: post.title,
          hasContent: Boolean(post.content),
          contentStructure: post.content ? Object.keys(post.content) : [],
          hasFreeWebContent: Boolean(post.free_web_content)
        })

        // Try to get content from either expanded content or regular content object
        const webContent = post.free_web_content || post.content?.free?.web || ''

        const content = {
          free: {
            web: webContent,
            email: post.content?.free?.email || '',
            rss: post.content?.free?.rss || ''
          },
          premium: {
            web: post.content?.premium?.web || '',
            email: post.content?.premium?.email || ''
          }
        }

        // Check if post already exists
        const { data: existingPost } = await supabase
          .from('newsletter_posts')
          .select('id')
          .eq('beehiiv_id', post.id)
          .single()

        if (existingPost) {
          console.log(`Updating existing post ${post.id}`)
          
          const { error: updateError } = await supabase
            .from('newsletter_posts')
            .update({
              content,
              stats: post.stats || {},
              status: post.status,
              title: post.title,
              subtitle: post.subtitle,
              web_url: post.web_url,
              thumbnail_url: post.thumbnail_url,
            })
            .eq('beehiiv_id', post.id)

          if (updateError) {
            console.error('Error updating post:', updateError)
          }
          
          skipped++
          continue
        }

        const { error } = await supabase
          .from('newsletter_posts')
          .insert({
            beehiiv_id: post.id,
            title: post.title,
            subtitle: post.subtitle,
            content,
            status: post.status,
            authors: Array.isArray(post.authors) ? post.authors : [],
            publish_date: post.publish_date
              ? new Date(post.publish_date * 1000).toISOString()
              : new Date().toISOString(),
            displayed_date: post.displayed_date
              ? new Date(post.displayed_date * 1000).toISOString()
              : new Date().toISOString(),
            web_url: post.web_url,
            thumbnail_url: post.thumbnail_url,
            slug: post.slug,
            audience: post.audience,
            preview_text: post.preview_text,
            meta_default_title: post.meta_default_title,
            meta_default_description: post.meta_default_description,
            stats: post.stats || {},
          })

        if (error) {
          console.error('Error importing post:', error)
          continue
        }

        // Verify the saved content
        const { data: verifyPost } = await supabase
          .from('newsletter_posts')
          .select('content')
          .eq('beehiiv_id', post.id)
          .single()
        
        console.log('Verified saved content:', {
          id: post.id,
          hasContent: Boolean(verifyPost?.content?.free?.web),
          contentLength: verifyPost?.content?.free?.web?.length || 0
        })

        imported++
        
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      hasMorePages = listData.page < listData.total_pages
      page++

      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      message: `Imported ${imported} new posts, skipped ${skipped} existing posts`
    })
    
  } catch (error) {
    console.error('Error in sync-newsletter:', error)
    return NextResponse.json(
      { error: 'Failed to sync newsletter posts' },
      { status: 500 }
    )
  }
}
