// supabase/functions/process-feeds-worker/lib/embed-post.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { OpenAI } from 'npm:openai@4.70.3'
import { Pinecone } from 'npm:@pinecone-database/pinecone@4.0.0'

// Type definitions
type SupabaseClient = ReturnType<typeof createClient>

interface EmbedPostResult {
  success: boolean;
  chunks?: number;
  error?: string;
  details?: string;
}

interface PineconeMetadata {
  post_id: number;
  title: string;
  link: string;
  chunk_index: number;
  total_chunks: number;
  content: string;
}

interface ContentStats {
  originalLength: number;
  cleanedLength: number;
  htmlTagsRemoved: number;
  entitiesReplaced: number;
}

interface ChunkConfig {
  size: number;
  overlap: number;
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
  
  console.log('OpenAI client initialized successfully for embeddings');
} catch (initError) {
  console.error('Error initializing OpenAI client for embeddings:', initError);
  throw initError;
}

// Initialize Pinecone with detailed error logging
let pinecone: Pinecone;
let index: any;
try {
  const pineconeApiKey = Deno.env.get('PINECONE_API_KEY');
  const pineconeIndexName = Deno.env.get('PINECONE_INDEX_NAME');
  
  if (!pineconeApiKey) {
    console.error('PINECONE_API_KEY environment variable is not set');
    throw new Error('Pinecone API key is missing');
  }
  
  if (!pineconeIndexName) {
    console.error('PINECONE_INDEX_NAME environment variable is not set');
    throw new Error('Pinecone index name is missing');
  }
  
  pinecone = new Pinecone({
    apiKey: pineconeApiKey
  });
  
  index = pinecone.index(pineconeIndexName);
  
  console.log('Pinecone client initialized successfully');
} catch (initError) {
  console.error('Error initializing Pinecone client:', initError);
  throw initError;
}

// Helper function to clean HTML content
function cleanHTML(html: string): string {
  console.log(`Cleaning HTML content of length: ${html.length}`);
  
  try {
    // In Deno, we don't have direct access to sanitize-html
    // This is a simplified version that removes HTML tags
    const cleanedText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
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

    console.log(`Cleaned HTML content, new length: ${cleanedText.length}`);
    return cleanedText;
  } catch (error) {
    console.error('Error cleaning HTML:', error);
    return html;
  }
}

function getContentStats(original: string, cleaned: string): ContentStats {
  const htmlTagCount = (original.match(/<[^>]*>/g) || []).length;
  const entityCount = (original.match(/&[a-zA-Z0-9#]+;/g) || []).length;

  return {
    originalLength: original.length,
    cleanedLength: cleaned.length,
    htmlTagsRemoved: htmlTagCount,
    entitiesReplaced: entityCount
  };
}

function getChunkConfig(contentLength: number): ChunkConfig {
  console.log(`Determining chunk config for content length: ${contentLength}`);
  
  if (contentLength < 5000) {
    console.log('Using small chunk configuration (1000/200)');
    return { size: 1000, overlap: 200 };      // Short content
  } else if (contentLength < 20000) {
    console.log('Using medium chunk configuration (2000/400)');
    return { size: 2000, overlap: 400 };      // Medium content
  } else {
    console.log('Using large chunk configuration (4000/800)');
    return { size: 4000, overlap: 800 };      // Long content
  }
}

// Simple text splitter function (replacement for RecursiveCharacterTextSplitter)
function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  console.log(`Splitting text of length ${text.length} into chunks (size: ${chunkSize}, overlap: ${overlap})`);
  
  const chunks: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
    i += chunkSize - overlap;
  }
  
  console.log(`Generated ${chunks.length} chunks`);
  return chunks;
}

export async function embedPost(postId: number, supabase: SupabaseClient): Promise<EmbedPostResult> {
  console.log(`Starting embedding process for post ${postId}`);
  
  try {
    // First generate a dummy embedding to use for the initial query
    console.log('Generating dummy embedding for querying existing vectors');
    let dummyEmbedding;
    try {
      dummyEmbedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "dummy text",
        dimensions: 1536,
        encoding_format: "float"
      });
      
      console.log('Successfully generated dummy embedding');
    } catch (embeddingError) {
      console.error('Error generating dummy embedding:', embeddingError);
      return {
        success: false,
        error: 'Failed to generate dummy embedding',
        details: embeddingError instanceof Error ? embeddingError.message : 'Unknown error'
      };
    }

    // Check for existing embeddings
    console.log(`Checking for existing embeddings for post ${postId}`);
    try {
      const existingVectors = await index.query({
        vector: dummyEmbedding.data[0].embedding,
        filter: {
          post_id: { $eq: postId }
        },
        topK: 1
      });

      // If embeddings exist, delete them
      if (existingVectors.matches && existingVectors.matches.length > 0) {
        console.log(`Found ${existingVectors.matches.length} existing embeddings for post ${postId}, removing them`);
        
        try {
          await index.deleteMany({
            filter: {
              post_id: { $eq: postId }
            }
          });
          
          console.log(`Successfully removed existing embeddings for post ${postId}`);
        } catch (deleteError) {
          console.error(`Error deleting existing embeddings for post ${postId}:`, deleteError);
          return {
            success: false,
            error: 'Failed to delete existing embeddings',
            details: deleteError instanceof Error ? deleteError.message : 'Unknown error'
          };
        }
      } else {
        console.log(`No existing embeddings found for post ${postId}`);
      }
    } catch (queryError) {
      console.error(`Error querying existing embeddings for post ${postId}:`, queryError);
      // Continue processing even if check fails
    }

    // Fetch the post content
    let post;
    try {
      console.log(`Fetching post ${postId} content from database`);
      const { data, error: fetchError } = await supabase
        .from('content_post')
        .select('content, title, description, link')
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

    // Clean the content
    console.log(`Cleaning content for post ${postId}`);
    const cleanContent = post.content ? cleanHTML(post.content) : '';
    const cleanDescription = post.description ? cleanHTML(post.description) : '';

    // Log cleaning stats
    if (post.content) {
      const stats = getContentStats(post.content, cleanContent);
      console.log(`Content cleaning stats for post ${postId}:`, stats);
    }

    // Verify post has content
    if (!cleanContent && !cleanDescription) {
      console.warn(`Post ${postId} has no content or description to embed after cleaning`);
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
    
    console.log(`Prepared content for embedding, length: ${contentToEmbed.length} characters`);

    // Get chunk configuration
    const chunkConfig = getChunkConfig(contentToEmbed.length);

    // Split text into chunks
    const chunks = splitTextIntoChunks(contentToEmbed, chunkConfig.size, chunkConfig.overlap);

    console.log(`Processing post ${postId} with chunk size ${chunkConfig.size} and ${chunks.length} chunks`);

    // Process each chunk
    let successfulChunks = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i+1}/${chunks.length} for post ${postId}, length: ${chunk.length}`);
        
        // Generate embedding
        console.log(`Generating embedding for chunk ${i+1}`);
        let embedding;
        try {
          embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: chunk,
            dimensions: 1536,
            encoding_format: "float"
          });
          
          console.log(`Successfully generated embedding for chunk ${i+1}`);
        } catch (embeddingError) {
          console.error(`Error generating embedding for chunk ${i+1}:`, embeddingError);
          throw embeddingError;
        }

        // Prepare metadata
        const metadata: PineconeMetadata = {
          post_id: postId,
          title: post.title || '',
          link: post.link || '',
          chunk_index: i,
          total_chunks: chunks.length,
          content: chunk
        };

        // Upload to Pinecone
        console.log(`Upserting chunk ${i+1} to Pinecone`);
        try {
          await index.upsert([{
            id: `post-${postId}-chunk-${i}`,
            values: embedding.data[0].embedding,
            metadata
          }]);
          
          console.log(`Successfully upserted chunk ${i+1} to Pinecone`);
          successfulChunks++;
        } catch (upsertError) {
          console.error(`Error upserting chunk ${i+1} to Pinecone:`, upsertError);
          throw upsertError;
        }
      } catch (chunkError) {
        console.error(`Error processing chunk ${i+1} for post ${postId}:`, chunkError);
        
        // If error occurs, cleanup vectors for this post
        try {
          console.log(`Cleaning up vectors for post ${postId} due to error`);
          await index.deleteMany({
            filter: {
              post_id: { $eq: postId }
            }
          });
          
          console.log(`Successfully cleaned up vectors for post ${postId}`);
        } catch (cleanupError) {
          console.error(`Error cleaning up vectors for post ${postId}:`, cleanupError);
        }

        return {
          success: false,
          error: 'Processing error',
          details: chunkError instanceof Error ? chunkError.message : 'Unknown error'
        };
      }
    }

    // Update indexed status in Supabase
    try {
      console.log(`Updating indexed status for post ${postId}`);
      const { error: updateError } = await supabase
        .from('content_post')
        .update({ indexed: true })
        .eq('id', postId);

      if (updateError) {
        console.error(`Failed to update indexed status for post ${postId}:`, updateError);
        return {
          success: false,
          error: 'Failed to update post indexed status',
          details: updateError.message
        };
      }
      
      console.log(`Successfully updated indexed status for post ${postId}`);
    } catch (updateError) {
      console.error(`Error updating indexed status for post ${postId}:`, updateError);
      return {
        success: false,
        error: 'Error updating post indexed status',
        details: updateError instanceof Error ? updateError.message : 'Unknown error'
      };
    }

    console.log(`Successfully embedded post ${postId} in ${chunks.length} chunks`);
    return {
      success: true,
      chunks: chunks.length
    };
  } catch (error) {
    console.error(`Unexpected error embedding post ${postId}:`, error);
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