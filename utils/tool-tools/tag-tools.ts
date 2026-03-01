import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  hasToolsLlmCredentials,
  toolsLlmClient,
  toolsLlmModel,
  toolsLlmProvider,
} from './llm'

interface TagToolResult {
  success: boolean
  suggestedTopics?: string[]
  error?: string
  details?: string
}

interface TopicSuggestion {
  name: string
  confidence: number
}

interface TopicSelectionPayload {
  topics: TopicSuggestion[]
}

function parseTopicSelectionPayload(content: string | null | undefined): TopicSelectionPayload {
  if (!content) {
    return { topics: [] }
  }

  const parsePayload = (value: string): TopicSelectionPayload | null => {
    try {
      const parsed = JSON.parse(value) as TopicSelectionPayload
      if (!Array.isArray(parsed.topics)) return { topics: [] }

      const topics = parsed.topics
        .filter((topic): topic is TopicSuggestion => {
          return (
            typeof topic?.name === 'string' &&
            typeof topic?.confidence === 'number' &&
            Number.isFinite(topic.confidence)
          )
        })
        .map((topic) => ({
          name: topic.name.trim(),
          confidence: Math.max(0, Math.min(1, topic.confidence)),
        }))

      return { topics }
    } catch {
      return null
    }
  }

  const direct = parsePayload(content.trim())
  if (direct) return direct

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const nested = parsePayload(jsonMatch[0])
    if (nested) return nested
  }

  return { topics: [] }
}

function generateRelationId() {
  return Math.floor(Math.random() * 1_000_000_000)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getHeuristicSuggestedTopics(
  content: string,
  topics: Array<{ name: string }>
): string[] {
  const haystack = content.toLowerCase()

  return topics
    .map((topic) => topic.name)
    .filter((topicName) => {
      const pattern = new RegExp(`\\b${escapeRegExp(topicName.toLowerCase())}\\b`)
      return pattern.test(haystack)
    })
    .slice(0, 4)
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

    let suggestedTopics: string[] = []
    if (hasToolsLlmCredentials) {
      try {
        const completion = await toolsLlmClient.chat.completions.create({
          model: toolsLlmModel,
          messages: [
            {
              role: 'system',
              content: `You categorize UX/design tools into topics with strict precision.

Return JSON only using this exact shape:
{"topics":[{"name":"<topic name>","confidence":0.0}]}

Rules:
- Select only directly evidenced topics from the provided list.
- Do not infer weak or tangential matches.
- Return max 4 topics, and it is valid to return zero topics.
- Use confidence 0-1 where 1 = explicit, direct match.
- Topic names must exactly match names from the list.

Available topics:\n${topicsString}`,
            },
            {
              role: 'user',
              content: `Categorize this tool:\n${contentToAnalyze}`,
            },
          ],
        })

        const parsed = parseTopicSelectionPayload(completion.choices[0]?.message?.content)
        suggestedTopics = Array.from(
          new Set(
            parsed.topics
              .filter((topic) => topic.confidence >= 0.65)
              .map((topic) => topic.name)
              .filter(Boolean)
          )
        ).slice(0, 4)
        console.log('[tagTool] AI topic suggestions', {
          toolId,
          suggestedTopics,
          provider: toolsLlmProvider,
          model: toolsLlmModel,
        })
      } catch (error) {
        console.warn('[tagTool] AI tagging failed, using heuristic fallback', {
          toolId,
          provider: toolsLlmProvider,
          model: toolsLlmModel,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } else {
      console.warn('[tagTool] No LLM credentials available for AI tagging; using heuristic fallback', {
        toolId,
      })
    }

    if (suggestedTopics.length === 0) {
      suggestedTopics = getHeuristicSuggestedTopics(contentToAnalyze, topics)
      console.log('[tagTool] Heuristic topic suggestions', { toolId, suggestedTopics })
    }

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
    console.error('[tagTool] Tool tagging failed', {
      toolId,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: 'Tool tagging failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
