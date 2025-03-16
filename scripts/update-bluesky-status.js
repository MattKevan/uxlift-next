// scripts/update-bluesky-status.js
const { createClient } = require('@supabase/supabase-js');
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

async function updateBlueskyStatus(postId) {
  try {
    console.log(`Updating Bluesky status for post ID: ${postId}`);
    
    // Find the latest Bluesky posting job
    const { data: job, error: jobError } = await supabase
      .from('feed_processing_jobs')
      .select('id')
      .eq('job_type', 'bluesky_posting')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let jobId = null;
    if (jobError) {
      console.error(`Error finding job record: ${jobError.message}`);
    } else {
      jobId = job.id;
    }
    
    // Update post status to indicate it was posted to Bluesky
    const { error: updateError } = await supabase
      .from('content_post')
      .update({ 
        bluesky_posted: true,
        bluesky_posted_at: new Date().toISOString()
      })
      .eq('id', postId);
    
    if (updateError) {
      console.error(`Error updating post status: ${updateError.message}`);
      
      // Update job status if we have a job ID
      if (jobId) {
        await supabase
          .from('feed_processing_jobs')
          .update({
            status: 'failed',
            error: `Failed to update post status: ${updateError.message}`,
            error_count: 1,
            completed_at: new Date().toISOString(),
            last_updated: new Date().toISOString()
          })
          .eq('id', jobId);
      }
      
      process.exit(1);
    }
    
    // Update job status if we have a job ID
    if (jobId) {
      await supabase
        .from('feed_processing_jobs')
        .update({
          status: 'completed',
          processed_items: 1,
          last_processed_item_id: postId,
          completed_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        })
        .eq('id', jobId);
    }
    
    console.log(`Successfully updated Bluesky status for post ID: ${postId}`);
    process.exit(0);
  } catch (error) {
    console.error('Error updating Bluesky status:', error);
    process.exit(1);
  }
}

updateBlueskyStatus(postId);