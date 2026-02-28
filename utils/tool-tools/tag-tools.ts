import { OpenAI } from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

interface TagToolResult {
  success: boolean
  suggestedTopics?: string[]
  error?: string
  details?: string
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

function generateRelationId() {
  return Math.floor(Math.random() * 1_000_000_000)
}

export async function tagTool(toolId: number, supabase: SupabaseClient): Promise<TagToolResult> {
  try {
    const { data: tool, error: fetchError } = await supabase
      .from('content_tool')
      .select('title, description, body')
      .eq('id', toolId)
      .single()

    if (fetchError || !tool) {
      return {
        success: false,
        error: 'Tool not found',
        details: fetchError?.message,
      }
    }

    const { data: topics, error: topicsError } = await supabase
      .from('content_topic')
      .select('*')
      .order('name')

    if (topicsError || !topics?.length) {
      return {
        success: false,
        error: 'No topics found',
        details: topicsError?.message,
      }
    }

    const contentToAnalyze = [
      tool.title ? `Title: ${tool.title}` : '',
      tool.description ? `Description: ${tool.description}` : '',
      tool.body ? `Body: ${tool.body}` : '',
    ].filter(Boolean).join('\n\n')

    if (!contentToAnalyze) {
      return {
        success: false,
        error: 'No content available to analyze',
      }
    }

    const topicsString = topics
      .map((topic) => `${topic.name}${topic.description ? ` (${topic.description})` : ''}`)
      .join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You categorize UX/design tools into topics.
Select up to 4 relevant topics from the provided list.
Return only topic names, comma-separated. No explanations.
Available topics:\n${topicsString}`,
        },
        {
          role: 'user',
          content: `Categorize this tool:\n${contentToAnalyze}`,
        },
      ],
    })

    const suggestedTopics = (completion.choices[0]?.message?.content || '')
      .split(/,|\n/)
      .map((topic) => topic.trim())
      .filter(Boolean)
      .slice(0, 4)

    const topicMap = new Map(topics.map((topic) => [topic.name.toLowerCase(), topic.id]))
    const topicIds = Array.from(
      new Set(
        suggestedTopics
          .map((topicName) => topicMap.get(topicName.toLowerCase()))
          .filter((topicId): topicId is number => typeof topicId === 'number')
      )
    )

    const { error: deleteError } = await supabase
      .from('content_tool_topics')
      .delete()
      .eq('tool_id', toolId)

    if (deleteError) {
      return {
        success: false,
        error: 'Failed to clear existing topics',
        details: deleteError.message,
      }
    }

    if (topicIds.length > 0) {
      const { error: insertError } = await supabase
        .from('content_tool_topics')
        .insert(
          topicIds.map((topicId) => ({
            id: generateRelationId(),
            tool_id: toolId,
            topic_id: topicId,
          }))
        )

      if (insertError) {
        return {
          success: false,
          error: 'Failed to insert tool topics',
          details: insertError.message,
        }
      }
    }

    return {
      success: true,
      suggestedTopics,
    }
  } catch (error) {
    return {
      success: false,
      error: 'Tool tagging failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
