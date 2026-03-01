// /utils/post-tools/embed-post.ts
import { OpenAI } from 'openai'
import { Pinecone, RecordMetadata } from '@pinecone-database/pinecone'
import type { Database } from '@/types/supabase'
import { createClient } from '@supabase/supabase-js'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import sanitizeHtml from 'sanitize-html'

const pinecone = new Pinecone()
const index = pinecone.index(process.env.PINECONE_INDEX_NAME || '')

type Post = Database['public']['Tables']['content_post']['Row']
type SupabaseClient = ReturnType<typeof createClient<Database>>

interface EmbedPostResult {
  success: boolean;
  chunks?: number;
  error?: string;
  details?: string;
}

interface PineconeMetadata extends RecordMetadata {
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

function cleanHTML(html: string): string {
  try {
    // First pass: Remove HTML while keeping structure
    const cleaned = sanitizeHtml(html, {
      allowedTags: [], // Remove all HTML tags
      allowedAttributes: {},
      textFilter: function(text) {
        return text
          .replace(/\s+/g, ' ') // Replace multiple spaces
          .replace(/\n\s*\n/g, '\n\n') // Clean up newlines
          .trim()
      },
      nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe'],
    })

    // Second pass: Clean up entities and special characters
    return cleaned
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


export async function embedPost(postId: number, supabase: SupabaseClient): Promise<EmbedPostResult> {
  try {
    if (!(process.env.OPENAI_API_KEY || '').trim()) {
      return {
        success: false,
        error: 'Embedding configuration error',
        details: 'OPENAI_API_KEY is missing on the server environment',
      }
    }

    if (!(process.env.PINECONE_INDEX_NAME || '').trim()) {
      return {
        success: false,
        error: 'Embedding configuration error',
        details: 'PINECONE_INDEX_NAME is missing on the server environment',
      }
    }

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

    // Initialize text splitter
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkConfig.size,
      chunkOverlap: chunkConfig.overlap,
    })

    // Split text into chunks
    const chunks = await textSplitter.createDocuments([contentToEmbed])

    console.log(`Processing post ${postId} with chunk size ${chunkConfig.size} and ${chunks.length} chunks`)

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      try {
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk.pageContent,
          dimensions: 1536,
          encoding_format: "float"
        })

        const metadata: PineconeMetadata = {
          post_id: postId,
          title: post.title || '',
          link: post.link || '',
          chunk_index: i,
          total_chunks: chunks.length,
          content: chunk.pageContent
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
