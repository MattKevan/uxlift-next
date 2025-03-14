// supabase/functions/process-feeds-worker/post-processor.ts
import { EdgeFunctionLogger } from '../_shared/logger.ts'
import { fetchAndProcessContent } from './lib/fetch-content.ts'
import { summarisePost } from './lib/summarise.ts'
import { tagPost } from './lib/tag-posts.ts'
import { embedPost } from './lib/embed-post.ts'

// Type for feed item result
interface FeedItemResult {
  success: boolean;
  postId?: number;
  error?: string;
}

// Process a single feed item
export async function processFeedItem(
  item: any,
  site: any,
  jobId: number,
  supabase: any,
  logger: EdgeFunctionLogger | null
): Promise<FeedItemResult> {
  // Truncate link for logging purposes
  const truncatedLink = item.link.length > 50 
    ? item.link.substring(0, 47) + '...' 
    : item.link;
  
  const stepName = `check_item_${truncatedLink.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  if (logger) await logger.startStep(stepName);
  console.log(`Checking item: ${truncatedLink}`);
  
  // Check if article already exists
  try {
    const { data: existing } = await supabase
      .from('content_post')
      .select('id')
      .eq('link', item.link)
      .single();
    
    if (existing) {
      console.log(`Item already exists: ${truncatedLink} (ID: ${existing.id})`);
      if (logger) await logger.endStep(stepName, true, 'Item already exists', { postId: existing.id });
      return { success: false, error: 'Item already exists' };
    }
  } catch (checkError) {
    // If error is "not found", that's expected - continue processing
    if (checkError.code !== 'PGRST116') {
      console.error(`Error checking existing post for ${truncatedLink}:`, checkError);
    }
  }
  
  console.log(`Item is new, processing: ${truncatedLink}`);
  if (logger) await logger.endStep(stepName, true, 'Item is new, processing');
  
  // Fetch content
  const fetchStepName = `fetch_content_${truncatedLink.replace(/[^a-zA-Z0-9]/g, '_')}`;
  if (logger) await logger.startStep(fetchStepName);
  
  let newPost;
  try {
    console.log(`Fetching content from: ${item.link}`);
    newPost = await fetchAndProcessContent(item.link, supabase);
    
    if (newPost) {
      console.log(`Content fetched successfully, created post ID: ${newPost.id}`);
      if (logger) await logger.endStep(fetchStepName, true, 'Content fetched successfully', 
        { postId: newPost.id, title: newPost.title });
    } else {
      console.error(`Failed to fetch content from ${item.link} - no post created`);
      if (logger) await logger.endStep(fetchStepName, false, 'Failed to fetch content');
      return { success: false, error: 'Failed to fetch content' };
    }
  } catch (fetchError) {
    console.error(`Error fetching content from ${item.link}:`, fetchError);
    if (logger) await logger.endStep(fetchStepName, false, 'Error fetching content', 
      { error: fetchError instanceof Error ? fetchError.message : 'Unknown error' });
    return { success: false, error: 'Error fetching content' };
  }
  
  // Update the post with site_id and status
  const updateStepName = `update_post_${newPost.id}`;
  if (logger) await logger.startStep(updateStepName);
  
  try {
    const { error: updateError } = await supabase
      .from('content_post')
      .update({
        site_id: site.id,
        status: 'published',
        date_published: item.pubDate || new Date().toISOString()
      })
      .eq('id', newPost.id);
    
    if (updateError) {
      console.error(`Failed to update post ${newPost.id}:`, updateError);
      if (logger) await logger.endStep(updateStepName, false, 'Failed to update post', 
        { error: updateError.message });
      return { success: false, error: 'Failed to update post' };
    }
    
    console.log(`Updated post ${newPost.id} with site ID and status`);
    if (logger) await logger.endStep(updateStepName, true, 'Post updated successfully');
  } catch (updateError) {
    console.error(`Error updating post ${newPost.id}:`, updateError);
    if (logger) await logger.endStep(updateStepName, false, 'Error updating post', 
      { error: updateError instanceof Error ? updateError.message : 'Unknown error' });
    return { success: false, error: 'Error updating post' };
  }
  
  // Process the post (summarize, tag, embed)
  try {
    // Summarize the post
    await summarizePost(newPost.id, supabase, logger);
    
    // Tag the post
    await tagPostContent(newPost.id, supabase, logger);
    
    // Embed the post
    await embedPostContent(newPost.id, supabase, logger);
    
    try {
      // Create event for successful post processing
      await supabase
        .from('feed_processing_events')
        .insert([{
          job_id: jobId,
          event_type: 'post_processed',
          payload: {
            post_id: newPost.id,
            site_id: site.id,
            title: newPost.title,
            link: newPost.link
          }
        }]);
      
      console.log(`Post ${newPost.id} processing complete`);
      return { success: true, postId: newPost.id };
    } catch (eventError) {
      console.error(`Error creating processing event for post ${newPost.id}:`, eventError);
      // Continue even if event creation fails
      return { success: true, postId: newPost.id };
    }
  } catch (processingError) {
    console.error(`Error processing content for ${item.link}:`, processingError);
    if (logger) {
      // Log detailed error information
      await logger.startStep(`processing_error_${newPost.id}`);
      await logger.endStep(`processing_error_${newPost.id}`, false, 'Content processing failed', {
        error: processingError instanceof Error ? processingError.message : 'Unknown error',
        stack: processingError instanceof Error ? processingError.stack : undefined,
        postId: newPost.id,
        link: item.link
      });
    }
    return { success: false, error: 'Error processing post', postId: newPost.id };
  }
}

// Summarize post
async function summarizePost(postId: number, supabase: any, logger: EdgeFunctionLogger | null) {
  const summarizeStepName = `summarize_post_${postId}`;
  if (logger) await logger.startStep(summarizeStepName);
  
  console.log(`Summarizing post ${postId}`);
  try {
    const summaryResult = await summarisePost(postId, supabase);
    
    if (summaryResult.success) {
      console.log(`Post ${postId} successfully summarized: "${summaryResult.summary?.substring(0, 50)}..."`);
      if (logger) await logger.endStep(summarizeStepName, true, 'Post summarized');
    } else {
      console.error(`Failed to summarize post ${postId}:`, summaryResult.error, summaryResult.details);
      if (logger) await logger.endStep(summarizeStepName, false, summaryResult.error || 'Unknown error', 
        { details: summaryResult.details });
    }
  } catch (summaryError) {
    console.error(`Error summarizing post ${postId}:`, summaryError);
    if (logger) await logger.endStep(summarizeStepName, false, 'Error summarizing post', 
      { error: summaryError instanceof Error ? summaryError.message : 'Unknown error' });
  }
}

// Tag post
async function tagPostContent(postId: number, supabase: any, logger: EdgeFunctionLogger | null) {
  const tagStepName = `tag_post_${postId}`;
  if (logger) await logger.startStep(tagStepName);
  
  console.log(`Tagging post ${postId}`);
  try {
    const tagResult = await tagPost(postId, supabase);
    
    if (tagResult.success) {
      console.log(`Post ${postId} successfully tagged with topics:`, 
        tagResult.suggestedTopics?.join(', ') || 'none');
      if (logger) await logger.endStep(tagStepName, true, 'Post tagged', 
        { topics: tagResult.suggestedTopics });
    } else {
      console.error(`Failed to tag post ${postId}:`, tagResult.error, tagResult.details);
      if (logger) await logger.endStep(tagStepName, false, tagResult.error || 'Unknown error', 
        { details: tagResult.details });
    }
  } catch (tagError) {
    console.error(`Error tagging post ${postId}:`, tagError);
    if (logger) await logger.endStep(tagStepName, false, 'Error tagging post', 
      { error: tagError instanceof Error ? tagError.message : 'Unknown error' });
  }
}

// Embed post
async function embedPostContent(postId: number, supabase: any, logger: EdgeFunctionLogger | null) {
  const embedStepName = `embed_post_${postId}`;
  if (logger) await logger.startStep(embedStepName);

  console.log(`Embedding post ${postId}`);
  try {
    const embedResult = await embedPost(postId, supabase);
    
    if (embedResult.success) {
      console.log(`Post ${postId} successfully embedded with ${embedResult.chunks} chunks`);
      if (logger) await logger.endStep(embedStepName, true, 
        `Post embedded with ${embedResult.chunks} chunks`);
    } else {
      console.error(`Failed to embed post ${postId}:`, embedResult.error, embedResult.details);
      if (logger) await logger.endStep(embedStepName, false, embedResult.error || 'Unknown error', 
        { details: embedResult.details });
    }
  } catch (embedError) {
    console.error(`Error embedding post ${postId}:`, embedError);
    if (logger) await logger.endStep(embedStepName, false, 'Error embedding post', 
      { error: embedError instanceof Error ? embedError.message : 'Unknown error' });
  }
}