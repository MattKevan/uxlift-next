// supabase/functions/process-feeds-worker/lib/embed-post.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { OpenAI } from 'npm:openai@4.70.3'
import { Pinecone } from 'npm:@pinecone-database/pinecone@4.0.0'

// Type definitions
type SupabaseClient = ReturnType<typeof createClient>

interface EmbedPostResult {
  success: boolean;
  chunks?: number;
  error?: string;
  details?: string;
}

interface PineconeMetadata {
  post_id: number;
  title: string;
  link: string;
  chunk_index: number;
  total_chunks: number;
  content: string;
}

interface ContentStats {
  originalLength: number;
  cleanedLength: number;
  htmlTagsRemoved: number;
  entitiesReplaced: number;
}

interface ChunkConfig {
  size: number;
  overlap: number;
}

// Initialize OpenAI and Pinecone
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY') || ''
})

const pinecone = new Pinecone({
  apiKey: Deno.env.get('PINECONE_API_KEY') || ''
})

const index = pinecone.index(Deno.env.get('PINECONE_INDEX_NAME') || '')

// Helper function to clean HTML content
function cleanHTML(html: string): string {
  try {
    // In Deno, we don't have direct access to sanitize-html
    // This is a simplified version that removes HTML tags
    const cleanedText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/\s+/g, ' ')
      .trim()

    return cleanedText
  } catch (error) {
    console.error('Error cleaning HTML:', error)
    return html
  }
}

function getContentStats(original: string, cleaned: string): ContentStats {
  const htmlTagCount = (original.match(/<[^>]*>/g) || []).length

  return {
    originalLength: original.length,
    cleanedLength: cleaned.length,
    htmlTagsRemoved: htmlTagCount,
    entitiesReplaced: (original.match(/&[a-zA-Z0-9#]+;/g) || []).length
  }
}

function getChunkConfig(contentLength: number): ChunkConfig {
  if (contentLength < 5000) {
    return { size: 1000, overlap: 200 };      // Short content
  } else if (contentLength < 20000) {
    return { size: 2000, overlap: 400 };      // Medium content
  } else {
    return { size: 4000, overlap: 800 };      // Long content
  }
}

// Simple text splitter function (replacement for RecursiveCharacterTextSplitter)
function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  let i = 0
  
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize)
    chunks.push(chunk)
    i += chunkSize - overlap
  }
  
  return chunks
}

export async function embedPost(postId: number, supabase: SupabaseClient): Promise<EmbedPostResult> {
  try {
    // First generate a dummy embedding to use for the initial query
    const dummyEmbedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "dummy text",
      dimensions: 1536,
      encoding_format: "float"
    })

    // Check for existing embeddings
    const existingVectors = await index.query({
      vector: dummyEmbedding.data[0].embedding,
      filter: {
        post_id: { $eq: postId }
      },
      topK: 1
    })

    // If embeddings exist, delete them
    if (existingVectors.matches && existingVectors.matches.length > 0) {
      console.log(`Removing existing embeddings for post ${postId}`)
      await index.deleteMany({
        filter: {
          post_id: { $eq: postId }
        }
      })
    }

    // Fetch the post content
    const { data: post, error: fetchError } = await supabase
      .from('content_post')
      .select('content, title, description, link')
      .eq('id', postId)
      .single()

    if (fetchError) {
      console.error('Error fetching post:', fetchError)
      return {
        success: false,
        error: 'Failed to fetch post',
        details: fetchError.message
      }
    }

    if (!post) {
      return {
        success: false,
        error: 'Post not found'
      }
    }

    // Clean the content
    const cleanContent = post.content ? cleanHTML(post.content) : ''
    const cleanDescription = post.description ? cleanHTML(post.description) : ''

    // Log cleaning stats
    if (post.content) {
      const stats = getContentStats(post.content, cleanContent)
      console.log(`Content cleaning stats for post ${postId}:`, stats)
    }

    // Verify post has content
    if (!cleanContent && !cleanDescription) {
      return {
        success: false,
        error: 'Post has no content or description to embed after cleaning'
      }
    }

    // Create content string for embedding
    const contentToEmbed = [
      post.title && `Title: ${post.title}`,
      cleanDescription && `Description: ${cleanDescription}`,
      cleanContent && `Content: ${cleanContent}`
    ].filter(Boolean).join('\n\n')

    // Get chunk configuration
    const chunkConfig = getChunkConfig(contentToEmbed.length)

    // Split text into chunks
    const chunks = splitTextIntoChunks(contentToEmbed, chunkConfig.size, chunkConfig.overlap)

    console.log(`Processing post ${postId} with chunk size ${chunkConfig.size} and ${chunks.length} chunks`)

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      try {
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk,
          dimensions: 1536,
          encoding_format: "float"
        })

        const metadata: PineconeMetadata = {
          post_id: postId,
          title: post.title || '',
          link: post.link || '',
          chunk_index: i,
          total_chunks: chunks.length,
          content: chunk
        }

        await index.upsert([{
          id: `post-${postId}-chunk-${i}`,
          values: embedding.data[0].embedding,
          metadata
        }])

      } catch (error) {
        // If error occurs, cleanup vectors for this post
        await index.deleteMany({
          filter: {
            post_id: { $eq: postId }
          }
        })

        console.error('Error processing chunk:', error)
        return {
          success: false,
          error: 'Processing error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Update indexed status in Supabase
    const { error: updateError } = await supabase
      .from('content_post')
      .update({ indexed: true })
      .eq('id', postId)

    if (updateError) {
      console.error('Error updating post indexed status:', updateError)
      return {
        success: false,
        error: 'Failed to update post indexed status',
        details: updateError.message
      }
    }

    console.log(`Successfully embedded post ${postId} in ${chunks.length} chunks`)
    return {
      success: true,
      chunks: chunks.length
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}