import type { Database } from '@/types/supabase'
import { createClient } from '@supabase/supabase-js'
import {
  contentLlmClient,
  contentLlmModel,
  contentLlmProvider,
  hasContentLlmCredentials,
} from '@/utils/llm'

type SupabaseClient = ReturnType<typeof createClient<Database>>

interface SummariseResourceResult {
  success: boolean
  summary?: string
  error?: string
  details?: string
}

export async function summariseResource(
  resourceId: number,
  supabase: SupabaseClient
): Promise<SummariseResourceResult> {
  try {
    const { data: resource, error: fetchError } = await supabase
      .from('content_resource')
      .select('title, description, body')
      .eq('id', resourceId)
      .single()

    if (fetchError || !resource) {
      return {
        success: false,
        error: 'Resource not found',
        details: fetchError?.message,
      }
    }

    const content = [resource.title, resource.description, resource.body]
      .filter(Boolean)
      .join('\n\n')
      .trim()

    if (!content) {
      return {
        success: false,
        error: 'No content to summarise',
      }
    }

    if (!hasContentLlmCredentials) {
      return {
        success: false,
        error: 'No LLM credentials configured for summarisation',
      }
    }

    const completion = await contentLlmClient.chat.completions.create({
      model: contentLlmModel,
      messages: [
        {
          role: 'system',
          content:
            'You write concise summaries for UX resources. Keep summary under 30 words and highlight what the resource is useful for.',
        },
        {
          role: 'user',
          content: `Summarize this resource:\n${content}`,
        },
      ],
    })

    const summary = completion.choices[0]?.message?.content?.trim()

    if (!summary) {
      return {
        success: false,
        error: 'Failed to generate summary',
      }
    }

    const { error: updateError } = await supabase
      .from('content_resource')
      .update({ summary })
      .eq('id', resourceId)

    if (updateError) {
      return {
        success: false,
        error: 'Failed to update resource summary',
        details: updateError.message,
      }
    }

    return {
      success: true,
      summary,
    }
  } catch (error) {
    console.error('Resource summarisation error:', {
      provider: contentLlmProvider,
      model: contentLlmModel,
      error,
    })
    return {
      success: false,
      error: 'Resource summarisation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
