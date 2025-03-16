// scripts/get-next-post-for-bluesky.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Format a post for Bluesky
function formatBlueskyPost(post, postTopics, allTopics) {
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

// Main function to get the next article for Bluesky posting
async function getNextPostForBluesky() {
  // Create a log record for this run
  const { data: job, error: jobError } = await supabase
    .from('feed_processing_jobs')
    .insert([{ 
      status: 'processing',
      job_type: 'bluesky_posting',
      is_cron: true,
      total_sites: 0,
      processed_sites: 0,
      processed_items: 0,
      error_count: 0,
      started_at: new Date().toISOString()
    }])
    .select()
    .single();
  
  if (jobError) {
    console.error(`Failed to create job record: ${jobError.message}`);
    // Continue without a job record
  } else {
    console.log(`Created job record with ID: ${job.id}`);
  }
  console.log('Finding next post for Bluesky');
  
  try {
    // Get posts that haven't been posted to Bluesky yet
    // They should have status 'published', be indexed, and have bluesky_posted as false or null
    const { data: posts, error: fetchError } = await supabase
      .from('content_post')
      .select('id, title, summary, link, tags_list')
      .eq('status', 'published')
      .eq('indexed', true) 
      .or('bluesky_posted.is.null,bluesky_posted.eq.false')  // Check for both null and false
      .order('date_published', { ascending: true })
      .limit(1);
    
    if (fetchError) {
      throw new Error(`Failed to fetch posts: ${fetchError.message}`);
    }
    
    if (!posts || posts.length === 0) {
      console.log('No posts to publish to Bluesky');
      return null;
    }
    
    const post = posts[0];
    console.log(`Found post to publish: ${post.id} - ${post.title}`);
    
    // Get topics for hashtags
    const { data: topics, error: topicsError } = await supabase
      .from('content_topic')
      .select('id, name, slug');
    
    if (topicsError) {
      console.error('Error fetching topics:', topicsError);
      // Continue without topics if there's an error
    }
    
    // Get post topics for hashtags
    const { data: postTopics, error: postTopicsError } = await supabase
      .from('content_post_topics')
      .select('topic_id')
      .eq('post_id', post.id);
    
    if (postTopicsError) {
      console.error('Error fetching post topics:', postTopicsError);
      // Continue without post topics if there's an error
    }
    
    // Format post content for Bluesky
    const blueskyContent = formatBlueskyPost(post, postTopics, topics);
    
    // Extract topic tags for the Bluesky post action
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
    
    // Add tags from tags_list if available
    if (post.tags_list) {
      try {
        // Parse tags if stored as JSON string
        const tags = typeof post.tags_list === 'string' 
          ? JSON.parse(post.tags_list) 
          : post.tags_list;
        
        if (Array.isArray(tags)) {
          tags.forEach(tag => {
            // Remove spaces and special characters for tags
            const formattedTag = tag.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!topicTags.includes(formattedTag)) {
              topicTags.push(formattedTag);
            }
          });
        }
      } catch (error) {
        console.error('Error parsing tags_list:', error);
      }
    }
    
    // Write post data to file for GitHub Actions
    const postData = {
      POST_ID: post.id,
      POST_CONTENT: blueskyContent.replace(/"/g, '\\"').replace(/\n/g, '\\n'), // Escape quotes and newlines for shell
      POST_TAGS: topicTags.slice(0, 5).join(',') // Max 5 tags for Bluesky
    };
    
    // Format the file in a way that can be sourced in bash
    const fileContent = Object.entries(postData)
      .map(([key, value]) => `${key}="${value.toString().replace(/"/g, '\\"')}"`)
      .join('\n');
    
    fs.writeFileSync('.post-data', fileContent);
    console.log('Post data written to .post-data file');
    
    // Update job status if we have a job record
    if (job && job.id) {
      await supabase
        .from('feed_processing_jobs')
        .update({
          status: 'processing',
          processed_items: 1,
          last_processed_item_id: post.id,
          last_updated: new Date().toISOString()
        })
        .eq('id', job.id);
    }
    
    return postData;
  } catch (error) {
    console.error('Error getting next post for Bluesky:', error);
    
    // Update job status if we have a job record
    if (job && job.id) {
      await supabase
        .from('feed_processing_jobs')
        .update({
          status: 'failed',
          error: error.message,
          error_count: 1,
          completed_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        })
        .eq('id', job.id);
    }
    
    throw error;
  }
}

// Run the main function if called directly
if (require.main === module) {
  getNextPostForBluesky()
    .then(() => {
      console.log('Successfully completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Process failed:', error);
      process.exit(1);
    });
}

// Export functions
module.exports = {
  getNextPostForBluesky,
  formatBlueskyPost
};