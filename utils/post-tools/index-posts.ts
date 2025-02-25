// /utils/post-tools/index-posts.ts
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import type { Database } from '@/types/supabase'
import { createClient } from '@supabase/supabase-js'

type Post = Database['public']['Tables']['content_post']['Row']
type SupabaseClient = ReturnType<typeof createClient<Database>>

interface IndexPostResult {
  success: boolean;
  post?: Post;
  error?: string;
  details?: string;
}

export async function indexPost(postId: number, supabase: SupabaseClient): Promise<IndexPostResult> {
  try {
    // Fetch the post content
    const { data: post, error: fetchError } = await supabase
      .from('content_post')
      .select('id, title, content, description')
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

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY
    })

    // Create content string for embedding
    const contentToEmbed = [
      post.title,
      post.description,
      post.content
    ].filter(Boolean).join('\n\n')

    if (!contentToEmbed) {
      return {
        success: false,
        error: 'No content available to embed'
      }
    }

    try {
      // Generate embeddings
      const [contentEmbedding, titleEmbedding] = await Promise.all([
        embeddings.embedQuery(contentToEmbed),
        embeddings.embedQuery(post.title)
      ])

      // Store embeddings
      const { error: embeddingError } = await supabase
        .from('post_embeddings')
        .upsert({
          id: post.id,
          content_embedding: contentEmbedding,
          title_embedding: titleEmbedding
        })

      if (embeddingError) {
        throw new Error(`Failed to store embeddings: ${embeddingError.message}`)
      }

      // Mark post as indexed
      const { error: updateError } = await supabase
        .from('content_post')
        .update({ indexed: true })
        .eq('id', post.id)

      if (updateError) {
        throw new Error(`Failed to update post indexed status: ${updateError.message}`)
      }

      return {
        success: true,
        post
      }

    } catch (error) {
      console.error('Error processing embeddings:', error)
      return {
        success: false,
        error: 'Failed to process embeddings',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
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
