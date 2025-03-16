// scripts/post-to-bluesky.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Constants
const BATCH_SIZE = 5; // Number of posts to prepare at once
const MAX_POSTS_PER_RUN = 10; // Maximum posts to process in a single run

// Main function to prepare articles for Bluesky posting
async function prepareArticlesForBluesky() {
  console.log('Starting Bluesky post preparation process');
  
  try {
    // Create a job record
    const { data: job, error: jobError } = await supabase
      .from('feed_processing_jobs')
      .insert([{ 
        status: 'processing',
        job_type: 'bluesky_posting',
        is_cron: true,
        total_sites: 0,
        processed_sites: 0,
        processed_items: 0,
        error_count: 0
      }])
      .select()
      .single();
    
    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }
    
    console.log(`Created job with ID: ${job.id}`);
    
    // Update job status
    await supabase
      .from('feed_processing_jobs')
      .update({ 
        started_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    
    // Get posts that haven't been posted to Bluesky yet
    // They should have status 'published', be indexed, and have bluesky_posted as false or null
    const { data: posts, error: fetchError } = await supabase
      .from('content_post')
      .select('id, title, summary, link, tags_list')
      .eq('status', 'published')
      .eq('indexed', true) 
      .is('bluesky_posted', null)
      .order('date_published', { ascending: true })
      .limit(MAX_POSTS_PER_RUN);
    
    if (fetchError) {
      throw new Error(`Failed to fetch posts: ${fetchError.message}`);
    }
    
    if (!posts || posts.length === 0) {
      console.log('No posts to publish to Bluesky');
      await updateJobStatus(job.id, 'completed', 'No posts to publish');
      return { processed: 0, success: 0, errors: 0 };
    }
    
    console.log(`Found ${posts.length} posts to publish to Bluesky`);
    
    // Update job with total items
    await supabase
      .from('feed_processing_jobs')
      .update({ 
        total_sites: 1,
        total_batches: Math.ceil(posts.length / BATCH_SIZE)
      })
      .eq('id', job.id);
    
    // Get topics for hashtags
    const { data: topics, error: topicsError } = await supabase
      .from('content_topic')
      .select('id, name, slug');
    
    if (topicsError) {
      console.error('Error fetching topics:', topicsError);
      // Continue without topics if there's an error
    }
    
    // Prepare post data for Bluesky
    const postsToPublish = [];
    
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      
      // Update job status for current post
      await supabase
        .from('feed_processing_jobs')
        .update({
          current_site: `Preparing Post ID: ${post.id}`,
          last_processed_item_id: post.id,
          last_updated: new Date().toISOString(),
          processed_items: i
        })
        .eq('id', job.id);
      
      try {
        // Get post topics for hashtags
        const { data: postTopics, error: postTopicsError } = await supabase
          .from('content_post_topics')
          .select('topic_id')
          .eq('post_id', post.id);
        
        // Extract topic names for tags parameter
        const topicTags = [];
        if (postTopics && postTopics.length > 0 && topics && topics.length > 0) {
          const topicMap = topics.reduce((map, topic) => {
            map[topic.id] = topic.name;
            return map;
          }, {});
          
          postTopics.forEach(topicRef => {
            const topicName = topicMap[topicRef.topic_id];
            if (topicName) {
              // Remove spaces and special characters for tags
              topicTags.push(topicName.toLowerCase().replace(/[^a-z0-9]/g, ''));
            }
          });
        }
        
        // Format post content for Bluesky
        const blueskyContent = await formatBlueskyPost(post, postTopics, topics);
        
        // Add to posts to publish
        postsToPublish.push({
          id: post.id,
          content: blueskyContent,
          tags: topicTags.length > 0 ? topicTags.join(',') : undefined
        });
        
        console.log(`Prepared post for Bluesky: ${post.title}`);
      } catch (error) {
        console.error(`Error preparing post ${post.id}:`, error);
        
        // Update job with error count
        await supabase
          .from('feed_processing_jobs')
          .update({
            error_count: (job.error_count || 0) + 1,
            last_updated: new Date().toISOString()
          })
          .eq('id', job.id);
      }
    }
    
    // Write posts to file for GitHub Actions to process
    if (postsToPublish.length > 0) {
      fs.writeFileSync('posts-to-publish.json', JSON.stringify(postsToPublish, null, 2));
      console.log(`Wrote ${postsToPublish.length} posts to posts-to-publish.json`);
    }
    
    // Update job status based on results
    if (postsToPublish.length > 0) {
      await updateJobStatus(job.id, 'processing', `Prepared ${postsToPublish.length} posts for Bluesky`);
    } else {
      await updateJobStatus(job.id, 'completed', 'No posts to publish after preparation');
    }
    
    return {
      processed: posts.length,
      prepared: postsToPublish.length,
      errors: posts.length - postsToPublish.length
    };
  } catch (error) {
    console.error('Error in Bluesky preparation process:', error);
    
    // Try to update job status if there was an error
    try {
      await updateJobStatus(null, 'failed', error.message);
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
    
    throw error;
  }
}

// Format a post for Bluesky
async function formatBlueskyPost(post, postTopics, allTopics) {
  // Start with the title and summary
  let content = `${post.title}\n\n`;
  
  // Add summary if available
  if (post.summary) {
    content += `${post.summary}\n\n`;
  }
  
  // Add the link
  content += `${post.link}\n\n`;
  
  // Add hashtags from post topics
  const hashtags = [];
  
  // If we have post topics and all topics, map them to hashtags
  if (postTopics && postTopics.length > 0 && allTopics && allTopics.length > 0) {
    // Create a map of topic IDs to names for easier lookup
    const topicMap = allTopics.reduce((map, topic) => {
      map[topic.id] = topic.slug || topic.name.toLowerCase().replace(/\s+/g, '');
      return map;
    }, {});
    
    // Get hashtags from post topics
    postTopics.forEach(topicRef => {
      const topicSlug = topicMap[topicRef.topic_id];
      if (topicSlug) {
        hashtags.push(`#${topicSlug}`);
      }
    });
  }
  
  // Add tags from tags_list if available
  if (post.tags_list) {
    try {
      // Parse tags if stored as JSON string
      const tags = typeof post.tags_list === 'string' 
        ? JSON.parse(post.tags_list) 
        : post.tags_list;
      
      if (Array.isArray(tags)) {
        tags.forEach(tag => {
          const formattedTag = tag.toLowerCase().replace(/\s+/g, '');
          hashtags.push(`#${formattedTag}`);
        });
      }
    } catch (error) {
      console.error('Error parsing tags_list:', error);
    }
  }
  
  // Add hashtags to content (limit to 5 max)
  if (hashtags.length > 0) {
    content += hashtags.slice(0, 5).join(' ');
  }
  
  // Ensure the content doesn't exceed 300 characters (Bluesky's limit)
  if (content.length > 300) {
    // If too long, truncate the summary 
    const titleLength = post.title.length;
    const linkLength = post.link.length;
    const hashtagsLength = hashtags.length > 0 ? hashtags.slice(0, 5).join(' ').length : 0;
    
    // Calculate max length for summary to stay under 300 chars
    // 10 chars are reserved for newlines and spacing
    const maxSummaryLength = 300 - titleLength - linkLength - hashtagsLength - 10;
    
    if (maxSummaryLength > 20) {
      // Rebuild content with truncated summary
      content = `${post.title}\n\n`;
      if (post.summary && post.summary.length > 0) {
        content += `${post.summary.substring(0, maxSummaryLength - 3)}...\n\n`;
      }
      content += `${post.link}\n\n`;
      
      if (hashtags.length > 0) {
        content += hashtags.slice(0, 5).join(' ');
      }
    } else {
      // If summary can't be reasonably included, use just title, link, and tags
      content = `${post.title}\n\n${post.link}\n\n`;
      
      if (hashtags.length > 0) {
        content += hashtags.slice(0, 5).join(' ');
      }
    }
  }
  
  return content;
}

// Helper to update job status
async function updateJobStatus(jobId, status, errorMessage = null) {
  try {
    const updateData = {
      status,
      last_updated: new Date().toISOString()
    };
    
    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    if (errorMessage) {
      updateData.error = errorMessage;
    }
    
    if (status === 'completed' || status === 'failed') {
      updateData.duration = jobId ? 
        await calculateJobDuration(jobId) : 
        0;
    }
    
    let query = supabase
      .from('feed_processing_jobs')
      .update(updateData);
    
    if (jobId) {
      query = query.eq('id', jobId);
    } else {
      // If no job ID, update the most recent job with 'processing' status
      query = query.eq('status', 'processing').order('created_at', { ascending: false }).limit(1);
    }
    
    const { error } = await query;
    
    if (error) {
      console.error('Error updating job status:', error);
    }
  } catch (error) {
    console.error('Error in updateJobStatus:', error);
  }
}

// Calculate job duration in seconds
async function calculateJobDuration(jobId) {
  try {
    const { data: job, error } = await supabase
      .from('feed_processing_jobs')
      .select('created_at, started_at')
      .eq('id', jobId)
      .single();
    
    if (error || !job) {
      return 0;
    }
    
    const startTime = job.started_at ? new Date(job.started_at) : new Date(job.created_at);
    const endTime = new Date();
    
    return Math.round((endTime - startTime) / 1000);
  } catch (error) {
    console.error('Error calculating job duration:', error);
    return 0;
  }
}

// If executed directly (not imported)
if (require.main === module) {
  // Run the main function
  prepareArticlesForBluesky()
    .then(results => {
      console.log('Process completed successfully:', results);
      process.exit(0);
    })
    .catch(error => {
      console.error('Process failed:', error);
      process.exit(1);
    });
}

module.exports = {
  prepareArticlesForBluesky,
  formatBlueskyPost
};