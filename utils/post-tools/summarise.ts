// /utils/post-tools/summarise.ts
import type { Database } from '@/types/supabase'
import { createClient } from '@supabase/supabase-js'
import {
  contentLlmClient,
  contentLlmModel,
  contentLlmProvider,
  hasContentLlmCredentials,
} from '@/utils/llm'

type SupabaseClient = ReturnType<typeof createClient<Database>>

// Return type should match the Post type
interface SummariseResult {
  success: boolean;
  summary?: string;
  error?: string;
  details?: string;
}

export async function summarisePost(postId: number, supabase: SupabaseClient): Promise<SummariseResult> {
  try {
    const { data: post, error: fetchError } = await supabase
      .from('content_post')
      .select('content')
      .eq('id', postId)
      .single()

    if (fetchError || !post) {
      return {
        success: false,
        error: 'Post not found',
        details: fetchError?.message
      }
    }

    if (!post.content) {
      return {
        success: false,
        error: 'No content to summarise'
      }
    }

    if (!hasContentLlmCredentials) {
      return {
        success: false,
        error: 'No LLM credentials configured for summarisation',
      }
    }

    const completion = await contentLlmClient.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise summaries of articles. Keep summaries under 30 words while maintaining key points. It should read like an introduction to the article.'
        },
        {
          role: 'user',
          content: `Please summarize the following article: ${post.content}`
        }
      ],
      model: contentLlmModel,
    })

    const summary = completion.choices[0].message.content

    if (!summary) {
      return {
        success: false,
        error: 'Failed to generate summary'
      }
    }

    const { error: updateError } = await supabase
      .from('content_post')
      .update({ summary })
      .eq('id', postId)

    if (updateError) {
      return {
        success: false,
        error: 'Failed to update post with summary',
        details: updateError.message
      }
    }

    return {
      success: true,
      summary
    }
  } catch (error) {
    console.error('Summarization error:', {
      provider: contentLlmProvider,
      model: contentLlmModel,
      error,
    })
    return {
      success: false,
      error: 'Summarization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
