// supabase/functions/process-feeds-worker/lib/summarise.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { OpenAI } from 'npm:openai@4.70.3'

// Type definitions
type SupabaseClient = ReturnType<typeof createClient>

interface SummariseResult {
  success: boolean;
  summary?: string;
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
  
  console.log('OpenAI client initialized successfully');
} catch (initError) {
  console.error('Error initializing OpenAI client:', initError);
  throw initError;
}

export async function summarisePost(postId: number, supabase: SupabaseClient): Promise<SummariseResult> {
  console.log(`Starting summarization for post ${postId}`);
  
  try {
    // Fetch post content
    let post;
    try {
      console.log(`Fetching post ${postId} content from database`);
      const { data, error: fetchError } = await supabase
        .from('content_post')
        .select('content, title')
        .eq('id', postId)
        .single();

      if (fetchError || !data) {
        console.error(`Failed to fetch post ${postId}:`, fetchError);
        return {
          success: false,
          error: 'Post not found',
          details: fetchError?.message
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

    // Check if post has content
    if (!post.content) {
      console.warn(`Post ${postId} has no content to summarize`);
      return {
        success: false,
        error: 'No content to summarise'
      };
    }
    
    // Log content size metrics for debugging
    const contentLength = post.content.length;
    console.log(`Post ${postId} content metrics:`, {
      totalLength: contentLength,
      truncatedForLogging: contentLength > 1000,
      preview: post.content.substring(0, Math.min(200, contentLength)) + '...'
    });

    // Generate summary with OpenAI
    try {
      console.log(`Generating summary for post ${postId} using OpenAI API`);
      
      // Create a content preview for logging that doesn't flood the console
      const contentPreview = post.content.length > 500 
        ? post.content.substring(0, 500) + '...' 
        : post.content;
      
      console.log(`Using model: gpt-4o-mini for summarization`);
      console.log(`Input content preview: "${contentPreview}"`);
      
      const completion = await openai.chat.completions.create({
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
        model: 'gpt-4o-mini',
      });

      const summary = completion.choices[0].message.content;
      
      if (!summary) {
        console.error(`OpenAI API returned empty summary for post ${postId}`);
        return {
          success: false,
          error: 'Failed to generate summary'
        };
      }
      
      console.log(`Successfully generated summary for post ${postId}: "${summary}"`);
      
      // Update post with summary
      try {
        console.log(`Updating post ${postId} with generated summary`);
        const { error: updateError } = await supabase
          .from('content_post')
          .update({ summary })
          .eq('id', postId);

        if (updateError) {
          console.error(`Failed to update post ${postId} with summary:`, updateError);
          return {
            success: false,
            error: 'Failed to update post with summary',
            details: updateError.message
          };
        }
        
        console.log(`Successfully updated post ${postId} with summary`);
      } catch (updateError) {
        console.error(`Error updating post ${postId} with summary:`, updateError);
        return {
          success: false,
          error: 'Error updating post with summary',
          details: updateError instanceof Error ? updateError.message : 'Unknown error'
        };
      }

      return {
        success: true,
        summary
      };
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
  } catch (error) {
    console.error(`Summarization error for post ${postId}:`, error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    return {
      success: false,
      error: 'Summarization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}