import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  contentLlmClient,
  contentLlmModel,
  contentLlmProvider,
  hasContentLlmCredentials,
} from '@/utils/llm'

interface TagResourceResult {
  success: boolean
  suggestedTopics?: string[]
  selectedCategorySlug?: string | null
  error?: string
  details?: string
}

interface ResourceClassification {
  topicNames: string[]
  resourceCategorySlug: string | null
}

function parseClassificationResponse(content: string | null | undefined): ResourceClassification {
  if (!content) {
    return {
      topicNames: [],
      resourceCategorySlug: null,
    }
  }

  const trimmed = content.trim()

  const parsePayload = (payload: string): ResourceClassification | null => {
    try {
      const parsed = JSON.parse(payload) as ResourceClassification
      const topicNames = Array.isArray(parsed.topicNames)
        ? parsed.topicNames.filter((topicName): topicName is string => typeof topicName === 'string')
        : []

      const resourceCategorySlug =
        typeof parsed.resourceCategorySlug === 'string'
          ? parsed.resourceCategorySlug.toLowerCase()
          : null

      return {
        topicNames,
        resourceCategorySlug,
      }
    } catch {
      return null
    }
  }

  const direct = parsePayload(trimmed)
  if (direct) return direct

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const nested = parsePayload(jsonMatch[0])
    if (nested) return nested
  }

  return {
    topicNames: [],
    resourceCategorySlug: null,
  }
}

export async function tagResource(
  resourceId: number,
  supabase: SupabaseClient<Database>
): Promise<TagResourceResult> {
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

    const { data: topics, error: topicsError } = await supabase
      .from('content_topic')
      .select('id, name, slug, description')
      .order('name')

    if (topicsError || !topics?.length) {
      return {
        success: false,
        error: 'No topics found',
        details: topicsError?.message,
      }
    }

    const { data: categories, error: categoriesError } = await supabase
      .from('content_resource_category')
      .select('id, name, slug, description')
      .order('sort_order', { ascending: true })

    if (categoriesError || !categories?.length) {
      return {
        success: false,
        error: 'No resource categories found',
        details: categoriesError?.message,
      }
    }

    const contentToAnalyze = [
      resource.title ? `Title: ${resource.title}` : '',
      resource.description ? `Description: ${resource.description}` : '',
      resource.body ? `Body: ${resource.body}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    if (!contentToAnalyze) {
      return {
        success: false,
        error: 'No content available to analyze',
      }
    }

    const topicsString = topics
      .map((topic) => `${topic.name}${topic.description ? ` (${topic.description})` : ''}`)
      .join('\n')

    const categoriesString = categories
      .map((category) => `${category.slug}: ${category.name}${category.description ? ` (${category.description})` : ''}`)
      .join('\n')

    if (!hasContentLlmCredentials) {
      return {
        success: false,
        error: 'No LLM credentials configured for tagging',
      }
    }

    const completion = await contentLlmClient.chat.completions.create({
      model: contentLlmModel,
      messages: [
        {
          role: 'system',
          content: `You categorize UX resources.
Select up to 4 topics and exactly 1 resource category slug.
Return JSON with this exact shape:
{"topicNames": ["..."], "resourceCategorySlug": "..."}

Rules:
- topicNames must come from the provided topics list.
- resourceCategorySlug must come from the provided category slug list.
- if no category is a direct fit, return null for resourceCategorySlug.

Available topics:\n${topicsString}

Available resource categories:\n${categoriesString}`,
        },
        {
          role: 'user',
          content: `Categorize this resource:\n${contentToAnalyze}`,
        },
      ],
    })

    const parsed = parseClassificationResponse(completion.choices[0]?.message?.content)

    const topicMap = new Map(topics.map((topic) => [topic.name.toLowerCase(), topic.id]))
    const topicIds = Array.from(
      new Set(
        parsed.topicNames
          .map((topicName) => topicMap.get(topicName.toLowerCase()))
          .filter((topicId): topicId is number => typeof topicId === 'number')
      )
    ).slice(0, 4)

    const category = categories.find(
      (resourceCategory) => resourceCategory.slug.toLowerCase() === (parsed.resourceCategorySlug || '').toLowerCase()
    )

    const { error: deleteError } = await supabase
      .from('content_resource_topics')
      .delete()
      .eq('resource_id', resourceId)

    if (deleteError) {
      return {
        success: false,
        error: 'Failed to clear existing resource topics',
        details: deleteError.message,
      }
    }

    if (topicIds.length > 0) {
      const { error: insertError } = await supabase.from('content_resource_topics').insert(
        topicIds.map((topicId) => ({
          resource_id: resourceId,
          topic_id: topicId,
        }))
      )

      if (insertError) {
        return {
          success: false,
          error: 'Failed to insert resource topics',
          details: insertError.message,
        }
      }
    }

    const { error: categoryUpdateError } = await supabase
      .from('content_resource')
      .update({ resource_category_id: category?.id || null })
      .eq('id', resourceId)

    if (categoryUpdateError) {
      return {
        success: false,
        error: 'Failed to update resource category',
        details: categoryUpdateError.message,
      }
    }

    return {
      success: true,
      suggestedTopics: parsed.topicNames,
      selectedCategorySlug: category?.slug || null,
    }
  } catch (error) {
    console.error('Resource tagging failed:', {
      provider: contentLlmProvider,
      model: contentLlmModel,
      error,
    })
    return {
      success: false,
      error: 'Resource tagging failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
