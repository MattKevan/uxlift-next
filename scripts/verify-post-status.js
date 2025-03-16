// scripts/verify-post-status.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get post ID from command line argument
const postId = process.argv[2];

if (!postId) {
  console.error('Error: Post ID is required');
  process.exit(1);
}

async function verifyPostStatus(postId) {
  try {
    console.log(`Verifying post status for ID: ${postId}`);
    
    // Check if the post exists and hasn't been posted to Bluesky
    const { data: post, error: fetchError } = await supabase
      .from('content_post')
      .select('id, title, bluesky_posted')
      .eq('id', postId)
      .single();
    
    if (fetchError) {
      console.error(`Error fetching post: ${fetchError.message}`);
      process.exit(1);
    }
    
    if (!post) {
      console.error(`Post with ID ${postId} not found`);
      process.exit(1);
    }
    
    // Check if the post has already been posted to Bluesky
    if (post.bluesky_posted === true) {
      console.log(`Post "${post.title}" (ID: ${postId}) has already been posted to Bluesky. Skipping.`);
      process.exit(0);
    }
    
    // If we get here, the post exists and hasn't been posted to Bluesky
    // Create a verification file for the GitHub Actions workflow
    fs.writeFileSync('.post-verified', 'verified');
    
    console.log(`Post "${post.title}" (ID: ${postId}) verified as not posted to Bluesky.`);
    process.exit(0);
  } catch (error) {
    console.error('Error verifying post status:', error);
    process.exit(1);
  }
}

verifyPostStatus(postId);