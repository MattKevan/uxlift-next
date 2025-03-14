// /utils/post-tools/tag-posts.ts

import { OpenAI } from 'openai'
import type { Database } from '@/types/supabase'
import { createClient } from '@supabase/supabase-js'

type Topic = Database['public']['Tables']['content_topic']['Row']
type Post = Database['public']['Tables']['content_post']['Row']
type PostWithRelations = Post & {
  content_site: {
    content: string | null
    description: string | null
    feed_url: string | null
    id: number
    include_in_newsfeed: boolean
    site_icon: string | null
    slug: string
    status: string
    title: string
    url: string
    user_id: number | null
  } | null
  content_post_topics: {
    content_topic: Topic
  }[]
}
type SupabaseClient = ReturnType<typeof createClient<Database>>

interface TagPostResult {
  success: boolean;
  post?: PostWithRelations;
  suggestedTopics?: string[];
  error?: string;
  details?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '' // Provide empty string as fallback
})

export async function tagPost(postId: number, supabase: SupabaseClient): Promise<TagPostResult> {
  try {
    // Fetch the post content
    const { data: post, error: fetchError } = await supabase
      .from('content_post')
      .select('content, title, description')
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

    // Fetch all available topics
    const { data: topics, error: topicsError } = await supabase
      .from('content_topic')
      .select('*')
      .order('name')

    if (topicsError) {
      console.error('Error fetching topics:', topicsError)
      return {
        success: false,
        error: 'Failed to fetch topics',
        details: topicsError.message
      }
    }

    if (!topics || topics.length === 0) {
      return {
        success: false,
        error: 'No topics found in database'
      }
    }

    // Create content string for analysis
    const contentToAnalyze = [
      post.title && `Title: ${post.title}`,
      post.description && `Description: ${post.description}`,
      post.content && `Content: ${post.content}`
    ].filter(Boolean).join('\n\n')

    if (!contentToAnalyze) {
      return {
        success: false,
        error: 'No content available to analyze'
      }
    }

    // Create topics string
    const topicsString = topics
      .map(topic => `${topic.name}${topic.description ? ` (${topic.description})` : ''}`)
      .join('\n')

    try {
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a content categorization expert. You will be given an article and a list of available topics. 
            Select up to 4 of the most relevant topics for the article, but it's ok not to return any tags if there are no direct matches. 
            Only select from the provided topics list. Respond with only the exact topic names, separated by commas. Do not include descriptions or explanations.
            Available topics:\n${topicsString}`
          },
          {
            role: 'user',
            content: `Please categorize this article:\n${contentToAnalyze}`
          }
        ],
        model: 'gpt-4o-mini',
      })

      const suggestedTopics = completion.choices[0].message.content
        ?.split(',')
        .map(topic => topic.trim())
        .filter(Boolean)
        .slice(0, 4)

      if (!suggestedTopics || suggestedTopics.length === 0) {
        return {
          success: false,
          error: 'No topics suggested by AI'
        }
      }

      // Match suggested topic names with topic IDs
      const topicIds = topics
        .filter(topic => suggestedTopics.includes(topic.name))
        .map(topic => topic.id)

      // Delete existing topics
      const { error: deleteError } = await supabase
        .from('content_post_topics')
        .delete()
        .eq('post_id', postId)

      if (deleteError) {
        console.error('Error deleting existing topics:', deleteError)
        return {
          success: false,
          error: 'Failed to remove existing topics',
          details: deleteError.message
        }
      }

      // Only proceed with insertion if we have topics to insert
      if (topicIds.length > 0) {
        const topicAssociations = topicIds.map(topic_id => ({
          post_id: postId,
          topic_id: topic_id,
        })) as Database['public']['Tables']['content_post_topics']['Insert'][]

        const { error: insertError } = await supabase
          .from('content_post_topics')
          .insert(topicAssociations)

        if (insertError) {
          console.error('Error inserting new topics:', insertError)
          return {
            success: false,
            error: 'Failed to insert new topics',
            details: insertError.message
          }
        }
      }

      // Fetch updated post
      const { data: updatedPost, error: updatedError } = await supabase
        .from('content_post')
        .select(`
          *,
          content_site (
            content,
            description,
            feed_url,
            id,
            include_in_newsfeed,
            site_icon,
            slug,
            status,
            title,
            url,
            user_id
          ),
          content_post_topics (
            content_topic (
              id,
              name,
              slug,
              description
            )
          )
        `)
        .eq('id', postId)
        .single()

      if (updatedError) {
        console.error('Error fetching updated post:', updatedError)
        return {
          success: false,
          error: 'Failed to fetch updated post',
          details: updatedError.message
        }
      }

      return {
        success: true,
        post: updatedPost as PostWithRelations,
        suggestedTopics
      }

    } catch (error) {
      console.error('OpenAI API error:', error)
      return {
        success: false,
        error: 'OpenAI API error',
        details: error instanceof Error ? error.message : 'Unknown OpenAI error'
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
