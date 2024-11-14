// /app/api/embed-all-posts/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { embedPost } from '@/utils/post-tools/embed-post'

// Add Response types
interface ProgressUpdate {
  type: 'progress';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentPost?: {
    id: number;
    title?: string;
  };
}

interface ErrorUpdate {
  type: 'error';
  postId: number;
  error: string;
  details?: string;
}

interface CompletionUpdate {
  type: 'complete';
  total: number;
  succeeded: number;
  failed: number;
  errors: ErrorUpdate[];
}
interface RequestBody {
    resetIndexStatus?: boolean;
  }
  
  export async function POST(request: Request) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
  
    const sendUpdate = async (data: ProgressUpdate | ErrorUpdate | CompletionUpdate) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };
  
    const processAllPosts = async () => {
      try {
        const supabase = await createClient();
        
        // Get total count of posts that need processing
        const { count: totalPosts, error: countError } = await supabase
          .from('content_post')
          .select('*', { count: 'exact', head: true })
          .eq('indexed', false)
          .eq('status', 'published'); // Only process published posts
  
        if (countError) {
          throw new Error(`Failed to get post count: ${countError.message}`);
        }
  
        if (!totalPosts) {
          await sendUpdate({
            type: 'complete',
            total: 0,
            succeeded: 0,
            failed: 0,
            errors: []
          });
          return;
        }
  
        const results = {
          total: totalPosts,
          processed: 0,
          succeeded: 0,
          failed: 0,
          errors: [] as ErrorUpdate[]
        };
  
        // Process posts in chunks
        const pageSize = 100;
        const batchSize = 3;
  
        for (let offset = 0; offset < totalPosts; offset += pageSize) {
          // Fetch chunk of unindexed posts
          const { data: posts, error: fetchError } = await supabase
            .from('content_post')
            .select('id, title, content')
            .eq('indexed', false)
            .eq('status', 'published')
            .range(offset, offset + pageSize - 1)
            .order('id');
  
          if (fetchError) {
            throw new Error(`Failed to fetch posts: ${fetchError.message}`);
          }
  
          if (!posts || posts.length === 0) continue;
  
          // Process posts in smaller batches
          for (let i = 0; i < posts.length; i += batchSize) {
            const batch = posts.slice(i, i + batchSize);
            
            await Promise.all(
              batch.map(async (post) => {
                try {
                  await sendUpdate({
                    type: 'progress',
                    ...results,
                    currentPost: {
                      id: post.id,
                      title: post.title
                    }
                  });
  
                  // Check if post has content to embed
                  if (!post.content) {
                    results.processed++;
                    results.failed++;
                    const errorUpdate: ErrorUpdate = {
                      type: 'error',
                      postId: post.id,
                      error: 'Post has no content to embed'
                    };
                    results.errors.push(errorUpdate);
                    await sendUpdate(errorUpdate);
                    return;
                  }
  
                  // Check for existing embeddings
                  const { count: existingCount, error: checkError } = await supabase
                    .from('documents')
                    .select('*', { count: 'exact', head: true })
                    .eq('metadata->post_id', post.id);
  
                  if (checkError) {
                    console.error(`Error checking existing embeddings for post ${post.id}:`, checkError);
                  }
  
                  if (existingCount && existingCount > 0) {
                    console.log(`Removing ${existingCount} existing embeddings for post ${post.id}`);
                    // Delete existing embeddings
                    const { error: deleteError } = await supabase
                      .from('documents')
                      .delete()
                      .eq('metadata->post_id', post.id);
  
                    if (deleteError) {
                      throw new Error(`Failed to delete existing embeddings: ${deleteError.message}`);
                    }
                  }
  
                  // Proceed with embedding
                  const result = await embedPost(post.id, supabase);
                  results.processed++;
  
                  if (result.success) {
                    results.succeeded++;
                    // Update indexed status
                    const { error: updateError } = await supabase
                      .from('content_post')
                      .update({ indexed: true })
                      .eq('id', post.id);
  
                    if (updateError) {
                      console.error(`Failed to update index status for post ${post.id}:`, updateError);
                    }
                  } else {
                    results.failed++;
                    const errorUpdate: ErrorUpdate = {
                      type: 'error',
                      postId: post.id,
                      error: result.error || 'Unknown error',
                      details: result.details
                    };
                    results.errors.push(errorUpdate);
                    await sendUpdate(errorUpdate);
                  }
  
                  await sendUpdate({
                    type: 'progress',
                    ...results
                  });
  
                } catch (error) {
                  results.processed++;
                  results.failed++;
                  const errorUpdate: ErrorUpdate = {
                    type: 'error',
                    postId: post.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  };
                  results.errors.push(errorUpdate);
                  await sendUpdate(errorUpdate);
                }
              })
            );
  
            // Rate limiting delay
            if (i + batchSize < posts.length) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
  
        await sendUpdate({
          type: 'complete',
          total: results.total,
          succeeded: results.succeeded,
          failed: results.failed,
          errors: results.errors
        });
  
      } catch (error) {
        await sendUpdate({
          type: 'error',
          postId: 0,
          error: 'Processing failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        writer.close();
      }
    };
  
    processAllPosts();
  
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }