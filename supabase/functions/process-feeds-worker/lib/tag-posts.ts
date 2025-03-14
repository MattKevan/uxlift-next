// supabase/functions/process-feeds-worker/lib/tag-posts.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { OpenAI } from 'npm:openai@4.70.3'

// Type definitions
type SupabaseClient = ReturnType<typeof createClient>

interface Topic {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

interface Post {
  id: number;
  title: string;
  content: string;
  description: string | null;
  link: string;
  // Add other fields as needed
}

interface TagPostResult {
  success: boolean;
  post?: any;
  suggestedTopics?: string[];
  error?: string;
  details?: string;
}

// Initialize OpenAI with detailed error logging
let openai: OpenAI;
try {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!apiKey) {
    console.error('OPENAI_API_KEY environment variable is not set');
    throw new Error('OpenAI API key is missing');
  }
  
  openai = new OpenAI({
    apiKey: apiKey,
  });
  
  console.log('OpenAI client initialized successfully for tagging');
} catch (initError) {
  console.error('Error initializing OpenAI client for tagging:', initError);
  throw initError;
}

export async function tagPost(postId: number, supabase: SupabaseClient): Promise<TagPostResult> {
  console.log(`Starting tagging process for post ${postId}`);
  
  try {
    // Fetch the post content
    let post;
    try {
      console.log(`Fetching post ${postId} content from database`);
      const { data, error: fetchError } = await supabase
        .from('content_post')
        .select('content, title, description')
        .eq('id', postId)
        .single();

      if (fetchError) {
        console.error(`Failed to fetch post ${postId}:`, fetchError);
        return {
          success: false,
          error: 'Failed to fetch post',
          details: fetchError.message
        };
      }

      if (!data) {
        console.error(`Post ${postId} not found`);
        return {
          success: false,
          error: 'Post not found'
        };
      }
      
      post = data;
      console.log(`Successfully fetched post ${postId}, title: "${post.title}"`);
    } catch (fetchError) {
      console.error(`Error fetching post ${postId}:`, fetchError);
      return {
        success: false,
        error: 'Error fetching post',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
      };
    }

    // Fetch all available topics
    let topics;
    try {
      console.log('Fetching available topics from database');
      const { data, error: topicsError } = await supabase
        .from('content_topic')
        .select('*')
        .order('name');

      if (topicsError) {
        console.error('Failed to fetch topics:', topicsError);
        return {
          success: false,
          error: 'Failed to fetch topics',
          details: topicsError.message
        };
      }

      if (!data || data.length === 0) {
        console.error('No topics found in database');
        return {
          success: false,
          error: 'No topics found in database'
        };
      }
      
      topics = data;
      console.log(`Successfully fetched ${topics.length} topics`);
      console.log('Topic examples:', topics.slice(0, 5).map(t => t.name).join(', '));
    } catch (topicsError) {
      console.error('Error fetching topics:', topicsError);
      return {
        success: false,
        error: 'Error fetching topics',
        details: topicsError instanceof Error ? topicsError.message : 'Unknown error'
      };
    }

    // Create content string for analysis
    const contentToAnalyze = [
      post.title && `Title: ${post.title}`,
      post.description && `Description: ${post.description}`,
      post.content && `Content: ${post.content.substring(0, 5000)}` // Limit content length for OpenAI
    ].filter(Boolean).join('\n\n');

    if (!contentToAnalyze) {
      console.warn(`Post ${postId} has no content available to analyze`);
      return {
        success: false,
        error: 'No content available to analyze'
      };
    }
    
    console.log(`Prepared content for analysis, length: ${contentToAnalyze.length} characters`);

    // Create topics string
    const topicsString = topics
      .map(topic => `${topic.name}${topic.description ? ` (${topic.description})` : ''}`)
      .join('\n');
    
    console.log(`Prepared topics list with ${topics.length} topics for OpenAI`);

    // Get topics from OpenAI
    let suggestedTopics;
    try {
      console.log(`Calling OpenAI API to categorize post ${postId}`);
      console.log('Using model: gpt-4o-mini for tagging');
      
      // Create content previews for logging
      const contentPreview = contentToAnalyze.length > 300 
        ? contentToAnalyze.substring(0, 300) + '...' 
        : contentToAnalyze;
      
      const topicsPreview = topics.length > 10
        ? topics.slice(0, 10).map(t => t.name).join(', ') + '...'
        : topics.map(t => t.name).join(', ');
      
      console.log(`Input content preview: "${contentPreview}"`);
      console.log(`Topics preview: ${topicsPreview}`);
      
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
      });

      const response = completion.choices[0].message.content;
      console.log(`OpenAI response for post ${postId}: "${response}"`);
      
      suggestedTopics = response
        ?.split(',')
        .map(topic => topic.trim())
        .filter(Boolean)
        .slice(0, 4);

      if (!suggestedTopics || suggestedTopics.length === 0) {
        console.warn(`No topics suggested by AI for post ${postId}`);
        return {
          success: false,
          error: 'No topics suggested by AI'
        };
      }
      
      console.log(`OpenAI suggested ${suggestedTopics.length} topics:`, suggestedTopics);
    } catch (openaiError) {
      console.error(`OpenAI API error for post ${postId}:`, openaiError);
      console.error('OpenAI error details:', {
        name: openaiError instanceof Error ? openaiError.name : 'Unknown',
        message: openaiError instanceof Error ? openaiError.message : String(openaiError),
        stack: openaiError instanceof Error ? openaiError.stack : 'No stack trace'
      });
      
      return {
        success: false,
        error: 'OpenAI API error',
        details: openaiError instanceof Error ? openaiError.message : 'Unknown OpenAI error'
      };
    }

    // Match suggested topic names with topic IDs
    const topicIds = topics
      .filter(topic => suggestedTopics.includes(topic.name))
      .map(topic => topic.id);
    
    console.log(`Matched ${topicIds.length} topic IDs from suggested topics`);

    // Delete existing topics
    try {
      console.log(`Deleting existing topics for post ${postId}`);
      const { error: deleteError } = await supabase
        .from('content_post_topics')
        .delete()
        .eq('post_id', postId);

      if (deleteError) {
        console.error(`Error deleting existing topics for post ${postId}:`, deleteError);
        return {
          success: false,
          error: 'Failed to remove existing topics',
          details: deleteError.message
        };
      }
      
      console.log(`Successfully deleted existing topics for post ${postId}`);
    } catch (deleteError) {
      console.error(`Error deleting existing topics for post ${postId}:`, deleteError);
      return {
        success: false,
        error: 'Error deleting existing topics',
        details: deleteError instanceof Error ? deleteError.message : 'Unknown error'
      };
    }

    // Insert new topic associations
    if (topicIds.length > 0) {
      try {
        console.log(`Inserting ${topicIds.length} new topics for post ${postId}:`, topicIds);
        const topicAssociations = topicIds.map(topic_id => ({
          post_id: postId,
          topic_id: topic_id,
        }));

        const { error: insertError } = await supabase
          .from('content_post_topics')
          .insert(topicAssociations);

        if (insertError) {
          console.error(`Failed to insert new topics for post ${postId}:`, insertError);
          return {
            success: false,
            error: 'Failed to insert new topics',
            details: insertError.message
          };
        }
        
        console.log(`Successfully inserted ${topicIds.length} topics for post ${postId}`);
      } catch (insertError) {
        console.error(`Error inserting new topics for post ${postId}:`, insertError);
        return {
          success: false,
          error: 'Error inserting new topics',
          details: insertError instanceof Error ? insertError.message : 'Unknown error'
        };
      }
    } else {
      console.log(`No matching topic IDs found for post ${postId}, skipping insertion`);
    }

    // Fetch updated post
    let updatedPost;
    try {
      console.log(`Fetching updated post ${postId} with topics`);
      const { data, error: updatedError } = await supabase
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
        .single();

      if (updatedError) {
        console.error(`Failed to fetch updated post ${postId}:`, updatedError);
        return {
          success: false,
          error: 'Failed to fetch updated post',
          details: updatedError.message
        };
      }
      
      if (!data) {
        console.error(`Updated post ${postId} not found`);
        return {
          success: false,
          error: 'Updated post not found'
        };
      }
      
      updatedPost = data;
      console.log(`Successfully fetched updated post ${postId} with topics`);
      
      const assignedTopics = updatedPost.content_post_topics.map(t => t.content_topic.name);
      console.log(`Post ${postId} now has ${assignedTopics.length} topics:`, assignedTopics);
    } catch (fetchUpdatedError) {
      console.error(`Error fetching updated post ${postId}:`, fetchUpdatedError);
      return {
        success: false,
        error: 'Error fetching updated post',
        details: fetchUpdatedError instanceof Error ? fetchUpdatedError.message : 'Unknown error'
      };
    }

    return {
      success: true,
      post: updatedPost,
      suggestedTopics
    };
  } catch (error) {
    console.error(`Unexpected error tagging post ${postId}:`, error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    return {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}