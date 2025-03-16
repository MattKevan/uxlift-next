// scripts/process-feeds.js
const { createClient } = require('@supabase/supabase-js');
const { Parser } = require('rss-parser');
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');

require('dotenv').config();

// Debug environment variables availability
console.log('Environment variables check:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'present' : 'missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'present' : 'missing');
console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? 'present' : 'missing');
console.log('PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME ? 'present' : 'missing');

// Validate required environment variables
if (!process.env.SUPABASE_URL) {
  console.error('ERROR: SUPABASE_URL environment variable is missing');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is missing');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is missing');
  process.exit(1);
}

if (!process.env.PINECONE_API_KEY) {
  console.error('ERROR: PINECONE_API_KEY environment variable is missing');
  process.exit(1);
}

if (!process.env.PINECONE_INDEX_NAME) {
  console.error('ERROR: PINECONE_INDEX_NAME environment variable is missing');
  process.exit(1);
}

// Cleanup HTML content
function cleanHTML(html) {
  try {
    // Remove script and style tags and content
    let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Use cheerio to parse and clean HTML
    const $ = cheerio.load(cleaned);
    $('script, style, iframe, noscript').remove();
    
    // Get text content
    cleaned = $.text()
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  } catch (error) {
    console.error('Error cleaning HTML:', error);
    return html;
  }
}

function getChunkConfig(contentLength) {
  if (contentLength < 5000) {
    return { size: 1000, overlap: 200 };      // Short content
  } else if (contentLength < 20000) {
    return { size: 2000, overlap: 400 };      // Medium content
  } else {
    return { size: 4000, overlap: 800 };      // Long content
  }
}

// Simple text splitter function
function splitTextIntoChunks(text, chunkSize, overlap) {
  const chunks = [];
  let i = 0;
  
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
    i += chunkSize - overlap;
  }
  
  return chunks;
}

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

const parser = new Parser({
  customFields: {
    item: ['content', 'contentSnippet']
  }
});

// Main functions adapted from your utility files
async function fetchAndProcessContent(rawUrl) {
  try {
    console.log('Starting content fetch for URL:', rawUrl);
    
    // Validate URL
    let validUrl;
    try {
      const url = new URL(rawUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol');
      }
      validUrl = url.toString();
    } catch (error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }

    // Check if URL already exists
    const { data: existingPost } = await supabase
      .from('content_post')
      .select('*')
      .eq('link', validUrl)
      .single();

    if (existingPost) {
      console.log('Post already exists:', validUrl);
      return existingPost;
    }

    const response = await fetch(validUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UXLift/1.0; +https://uxlift.org)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract metadata
    const title = $('meta[property="og:title"]').attr('content') || 
                 $('title').text() || 
                 $('meta[name="title"]').attr('content') || 
                 'Untitled';
    
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || 
                       '';
    
    const imagePath = $('meta[property="og:image"]').attr('content') || 
                     $('meta[property="twitter:image"]').attr('content') || 
                     null;

    // Extract content using Readability
    let content = '';
    try {
      const dom = new JSDOM(html, { url: validUrl });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      content = article ? article.textContent : '';
    } catch (readabilityError) {
      console.error('Readability error:', readabilityError);
      content = $('body').text().trim();
    }

    // Prepare post data
    const postData = {
      title: title.substring(0, 255),
      description: description.substring(0, 500),
      content,
      image_path: imagePath,
      link: validUrl,
      date_created: new Date().toISOString(),
      date_published: new Date().toISOString(),
      status: 'published',
      indexed: false,
      summary: '',
    };

    // Create post
    const { data: post, error: postError } = await supabase
      .from('content_post')
      .insert([postData])
      .select()
      .single();

    if (postError) {
      if (postError.code === '23505') { // Duplicate key error
        const { data: existingPost, error: fetchError } = await supabase
          .from('content_post')
          .select('*')
          .eq('link', validUrl)
          .single();

        if (fetchError) {
          throw new Error(`Failed to fetch existing post: ${fetchError.message}`);
        }

        return existingPost;
      }
      
      throw new Error(`Failed to insert post: ${postError.message}`);
    }

    if (!post) {
      throw new Error('Failed to create post: No data returned');
    }

    // Process the post
    try {
      await summarisePost(post.id);
      await tagPost(post.id);
      await embedPost(post.id);
    } catch (processingError) {
      console.error('Post processing error:', processingError);
    }

    return post;
  } catch (error) {
    console.error('Content fetching error:', error);
    throw error;
  }
}

async function summarisePost(postId) {
  try {
    const { data: post, error: fetchError } = await supabase
      .from('content_post')
      .select('content')
      .eq('id', postId)
      .single();

    if (fetchError || !post) {
      return {
        success: false,
        error: 'Post not found',
        details: fetchError?.message
      };
    }

    if (!post.content) {
      return {
        success: false,
        error: 'No content to summarise'
      };
    }

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
      return {
        success: false,
        error: 'Failed to generate summary'
      };
    }

    const { error: updateError } = await supabase
      .from('content_post')
      .update({ summary })
      .eq('id', postId);

    if (updateError) {
      return {
        success: false,
        error: 'Failed to update post with summary',
        details: updateError.message
      };
    }

    return {
      success: true,
      summary
    };
  } catch (error) {
    console.error('Summarization error:', error);
    return {
      success: false,
      error: 'Summarization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function tagPost(postId) {
  try {
    // Fetch the post content
    const { data: post, error: fetchError } = await supabase
      .from('content_post')
      .select('content, title, description')
      .eq('id', postId)
      .single();

    if (fetchError) {
      console.error('Error fetching post:', fetchError);
      return {
        success: false,
        error: 'Failed to fetch post',
        details: fetchError.message
      };
    }

    if (!post) {
      return {
        success: false,
        error: 'Post not found'
      };
    }

    // Fetch all available topics
    const { data: topics, error: topicsError } = await supabase
      .from('content_topic')
      .select('*')
      .order('name');

    if (topicsError) {
      console.error('Error fetching topics:', topicsError);
      return {
        success: false,
        error: 'Failed to fetch topics',
        details: topicsError.message
      };
    }

    if (!topics || topics.length === 0) {
      return {
        success: false,
        error: 'No topics found in database'
      };
    }

    // Create content string for analysis
    const contentToAnalyze = [
      post.title && `Title: ${post.title}`,
      post.description && `Description: ${post.description}`,
      post.content && `Content: ${post.content}`
    ].filter(Boolean).join('\n\n');

    if (!contentToAnalyze) {
      return {
        success: false,
        error: 'No content available to analyze'
      };
    }

    // Create topics string
    const topicsString = topics
      .map(topic => `${topic.name}${topic.description ? ` (${topic.description})` : ''}`)
      .join('\n');

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
      });

      const suggestedTopics = completion.choices[0].message.content
        ?.split(',')
        .map(topic => topic.trim())
        .filter(Boolean)
        .slice(0, 4);

      if (!suggestedTopics || suggestedTopics.length === 0) {
        return {
          success: false,
          error: 'No topics suggested by AI'
        };
      }

      // Match suggested topic names with topic IDs
      const topicIds = topics
        .filter(topic => suggestedTopics.includes(topic.name))
        .map(topic => topic.id);

      // Delete existing topics
      const { error: deleteError } = await supabase
        .from('content_post_topics')
        .delete()
        .eq('post_id', postId);

      if (deleteError) {
        console.error('Error deleting existing topics:', deleteError);
        return {
          success: false,
          error: 'Failed to remove existing topics',
          details: deleteError.message
        };
      }

      // Only proceed with insertion if we have topics to insert
      if (topicIds.length > 0) {
        const topicAssociations = topicIds.map(topic_id => ({
          post_id: postId,
          topic_id: topic_id,
        }));

        const { error: insertError } = await supabase
          .from('content_post_topics')
          .insert(topicAssociations);

        if (insertError) {
          console.error('Error inserting new topics:', insertError);
          return {
            success: false,
            error: 'Failed to insert new topics',
            details: insertError.message
          };
        }
      }

      return {
        success: true,
        suggestedTopics
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      return {
        success: false,
        error: 'OpenAI API error',
        details: error instanceof Error ? error.message : 'Unknown OpenAI error'
      };
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

async function embedPost(postId) {
  try {
    // First generate a dummy embedding to use for the initial query
    const dummyEmbedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "dummy text",
      dimensions: 1536,
      encoding_format: "float"
    });

    // Check for existing embeddings and delete them if they exist
    try {
      await index.deleteMany({
        filter: {
          post_id: { $eq: postId }
        }
      });
    } catch (error) {
      console.log('No existing embeddings to delete or error deleting:', error);
    }

    // Fetch the post content
    const { data: post, error: fetchError } = await supabase
      .from('content_post')
      .select('content, title, description, link')
      .eq('id', postId)
      .single();

    if (fetchError) {
      console.error('Error fetching post:', fetchError);
      return {
        success: false,
        error: 'Failed to fetch post',
        details: fetchError.message
      };
    }

    if (!post) {
      return {
        success: false,
        error: 'Post not found'
      };
    }

    // Clean the content
    const cleanContent = post.content ? cleanHTML(post.content) : '';
    const cleanDescription = post.description ? cleanHTML(post.description) : '';

    // Verify post has content
    if (!cleanContent && !cleanDescription) {
      return {
        success: false,
        error: 'Post has no content or description to embed after cleaning'
      };
    }

    // Create content string for embedding
    const contentToEmbed = [
      post.title && `Title: ${post.title}`,
      cleanDescription && `Description: ${cleanDescription}`,
      cleanContent && `Content: ${cleanContent}`
    ].filter(Boolean).join('\n\n');

    // Get chunk configuration
    const chunkConfig = getChunkConfig(contentToEmbed.length);

    // Split text into chunks
    const chunks = splitTextIntoChunks(contentToEmbed, chunkConfig.size, chunkConfig.overlap);

    console.log(`Processing post ${postId} with chunk size ${chunkConfig.size} and ${chunks.length} chunks`);

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk,
          dimensions: 1536,
          encoding_format: "float"
        });

        const metadata = {
          post_id: postId,
          title: post.title || '',
          link: post.link || '',
          chunk_index: i,
          total_chunks: chunks.length,
          content: chunk
        };

        await index.upsert([{
          id: `post-${postId}-chunk-${i}`,
          values: embedding.data[0].embedding,
          metadata
        }]);

      } catch (error) {
        // If error occurs, cleanup vectors for this post
        try {
          await index.deleteMany({
            filter: {
              post_id: { $eq: postId }
            }
          });
        } catch (deleteError) {
          console.error('Error cleaning up vectors after failure:', deleteError);
        }

        console.error('Error processing chunk:', error);
        return {
          success: false,
          error: 'Processing error',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Update indexed status in Supabase
    const { error: updateError } = await supabase
      .from('content_post')
      .update({ indexed: true })
      .eq('id', postId);

    if (updateError) {
      console.error('Error updating post indexed status:', updateError);
      return {
        success: false,
        error: 'Failed to update post indexed status',
        details: updateError.message
      };
    }

    console.log(`Successfully embedded post ${postId} in ${chunks.length} chunks`);
    return {
      success: true,
      chunks: chunks.length
    };

  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

async function processFeed(site) {
  console.log(`Processing feed for site: ${site.title}`);
  
  if (!site.feed_url) {
    console.log(`No feed URL for site ${site.title}`);
    return { processed: 0, errors: 0 };
  }
  
  let processed = 0;
  let errors = 0;
  
  try {
    // Parse the RSS feed
    const feed = await parser.parseURL(site.feed_url);
    
    console.log(`Found ${feed.items.length} items in feed for ${site.title}`);
    
    // Process each feed item
    for (const item of feed.items) {
      try {
        if (!item.link) continue;
        
        // Check if article already exists
        const { data: existing } = await supabase
          .from('content_post')
          .select('id')
          .eq('link', item.link)
          .single();
        
        if (existing) {
          console.log(`Post already exists: ${item.link}`);
          continue;
        }
        
        // Process new article
        const newPost = await fetchAndProcessContent(item.link);
        
        if (newPost) {
          // Update the post with site_id and status
          const { error: updateError } = await supabase
            .from('content_post')
            .update({
              site_id: site.id,
              status: 'published',
              date_published: item.pubDate || new Date().toISOString()
            })
            .eq('id', newPost.id);
          
          if (!updateError) {
            processed++;
            console.log(`Successfully processed: ${item.link}`);
          } else {
            console.error(`Error updating post metadata: ${updateError.message}`);
            errors++;
          }
        }
      } catch (itemError) {
        console.error(`Error processing item from ${site.title}:`, itemError);
        errors++;
      }
      
      // Add a small delay between items to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return { processed, errors };
  } catch (error) {
    console.error(`Error processing feed for ${site.title}:`, error);
    return { processed, errors: errors + 1 };
  }
}

// Main process function
async function processAllFeeds() {
  console.log('Starting feed processing');
  
  try {
    // Create a job record
    const { data: job, error: jobError } = await supabase
      .from('feed_processing_jobs')
      .insert([{ 
        status: 'processing',
        created_by: '00000000-0000-0000-0000-000000000000',
        is_cron: true
      }])
      .select()
      .single();
    
    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }
    
    console.log(`Created job with ID: ${job.id}`);
    
    // Get all active sites with feeds
    const { data: sites, error: sitesError } = await supabase
      .from('content_site')
      .select('*')
      .eq('include_in_newsfeed', true)
      .not('feed_url', 'is', null);
    
    if (sitesError) {
      throw new Error(`Failed to fetch sites: ${sitesError.message}`);
    }
    
    console.log(`Found ${sites.length} sites to process`);
    
    // Update job with total sites
    await supabase
      .from('feed_processing_jobs')
      .update({ 
        total_sites: sites.length,
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);
    
    const results = {
      processed: 0,
      errors: 0,
      sites: sites?.length || 0
    };
    
    // Process each site
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      
      // Update job status
      await supabase
        .from('feed_processing_jobs')
        .update({
          status: 'processing',
          current_site: site.title,
          last_processed_site_id: site.id,
          last_updated: new Date().toISOString(),
          processed_sites: i
        })
        .eq('id', job.id);
      
      const siteResult = await processFeed(site);
      results.processed += siteResult.processed;
      results.errors += siteResult.errors;
      
      console.log(`Completed site ${i + 1}/${sites.length}: ${site.title}`);
      console.log(`Processed ${siteResult.processed} posts with ${siteResult.errors} errors`);
      
      // Update job progress
      await supabase
        .from('feed_processing_jobs')
        .update({
          processed_sites: i + 1,
          processed_items: results.processed,
          error_count: results.errors,
          last_updated: new Date().toISOString()
        })
        .eq('id', job.id);
      
      // Add a delay between sites to avoid rate limiting
      if (i < sites.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Mark job as completed
    await supabase
      .from('feed_processing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration: Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000)
      })
      .eq('id', job.id);
    
    console.log('Feed processing completed successfully');
    console.log(`Processed ${results.processed} posts with ${results.errors} errors`);
    
    return results;
  } catch (error) {
    console.error('Error in feed processing:', error);
    
    // Update job as failed if we have a job ID
    try {
      await supabase
        .from('feed_processing_jobs')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .is('id', 'not.null');
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
    
    throw error;
  }
}

// Process posts that need embedding
async function processUnindexedPosts() {
  console.log('Starting to process unindexed posts');
  
  try {
    // Get unindexed posts
    const { data: posts, error: fetchError } = await supabase
      .from('content_post')
      .select('id, title')
      .eq('indexed', false)
      .eq('status', 'published')
      .order('id')
      .limit(100);
    
    if (fetchError) {
      throw new Error(`Failed to fetch unindexed posts: ${fetchError.message}`);
    }
    
    if (!posts || posts.length === 0) {
      console.log('No unindexed posts found');
      return { processed: 0, succeeded: 0, failed: 0 };
    }
    
    console.log(`Found ${posts.length} unindexed posts to process`);
    
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0
    };
    
    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      
      // Process each post in the batch
      const batchPromises = batch.map(async (post) => {
        try {
          console.log(`Processing post ${post.id}: ${post.title}`);
          const result = await embedPost(post.id);
          
          if (result.success) {
            console.log(`Successfully embedded post ${post.id}`);
            return { success: true };
          } else {
            console.error(`Failed to embed post ${post.id}: ${result.error}`);
            return { success: false, error: result.error };
          }
        } catch (error) {
          console.error(`Error processing post ${post.id}:`, error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Update results
      results.processed += batchResults.length;
      results.succeeded += batchResults.filter(r => r.success).length;
      results.failed += batchResults.filter(r => !r.success).length;
      
      console.log(`Batch ${Math.floor(i / batchSize) + 1} complete. Progress: ${results.processed}/${posts.length}`);
      
      // Add delay between batches
      if (i + batchSize < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log('Embedding process completed');
    console.log(`Processed ${results.processed} posts, ${results.succeeded} succeeded, ${results.failed} failed`);
    
    return results;
  } catch (error) {
    console.error('Error processing unindexed posts:', error);
    throw error;
  }
}

// Choose which process to run based on command line args
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'feeds';
  
  console.log(`Running command: ${command}`);
  
  try {
    switch (command) {
      case 'feeds':
        await processAllFeeds();
        break;
      case 'embed':
        await processUnindexedPosts();
        break;
      case 'both':
        await processAllFeeds();
        await processUnindexedPosts();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    
    console.log('Process completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Process failed:', error);
    process.exit(1);
  }
}

// Run the main function
main();