// scripts/get-test-post-for-bluesky.js
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
  // Start with just the title and link - no summary
  let content = `${post.title}\n\n${post.link}`;
  
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
      // Try to parse tags if stored as JSON string
      let tags;
      if (typeof post.tags_list === 'string') {
        // Check if it's a JSON string
        if (post.tags_list.startsWith('[') && post.tags_list.endsWith(']')) {
          try {
            tags = JSON.parse(post.tags_list);
          } catch (jsonError) {
            // If JSON parsing fails, try to split by comma
            tags = post.tags_list.split(',').map(t => t.trim());
          }
        } else {
          // Not JSON formatted, treat as comma-separated string
          tags = post.tags_list.split(',').map(t => t.trim());
        }
      } else {
        tags = post.tags_list;
      }
      
      if (Array.isArray(tags)) {
        tags.forEach(tag => {
          if (tag) {
            const formattedTag = tag.toLowerCase().replace(/\s+/g, '');
            hashtags.push(`#${formattedTag}`);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing tags_list:', error);
      // Continue without tags if there's an error
    }
  }
  
  // Check if we have space for hashtags
  const baseLength = content.length;
  const remainingSpace = 280 - baseLength;
  
  // Only add hashtags if we have more than 20 characters remaining
  if (remainingSpace > 20 && hashtags.length > 0) {
    // Calculate how many hashtags we can fit
    let hashtagText = '\n\n';
    let availableTags = [...hashtags];
    let count = 0;
    
    while (availableTags.length > 0 && hashtagText.length + availableTags[0].length + 1 < remainingSpace && count < 3) {
      hashtagText += availableTags.shift() + ' ';
      count++;
    }
    
    content += hashtagText.trim();
  }
  
  // Final check to ensure we're under the limit
  if (content.length > 280) {
    // If still too long, just use title and link without hashtags
    content = `${post.title}\n\n${post.link}`;
  }
  
  return content;
}

// Main function to get a specific test post for Bluesky posting
async function getTestPostForBluesky(offset = 0) {
  console.log(`Finding test post for Bluesky with offset: ${offset}`);
  
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
      .range(parseInt(offset), parseInt(offset))
      .limit(1);
    
    if (fetchError) {
      throw new Error(`Failed to fetch posts: ${fetchError.message}`);
    }
    
    if (!posts || posts.length === 0) {
      console.log(`No posts found at offset ${offset} or all posts have already been shared to Bluesky`);
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
    
    return postData;
  } catch (error) {
    console.error('Error getting test post for Bluesky:', error);
    throw error;
  }
}

// Get the offset from command line argument
const offset = process.argv[2] || 0;

// Run the main function if called directly
if (require.main === module) {
  getTestPostForBluesky(offset)
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
  getTestPostForBluesky,
  formatBlueskyPost
};