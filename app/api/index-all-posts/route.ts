// /app/api/index-all-posts/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { indexPost } from '@/utils/post-tools/index-posts'

export async function POST(request: Request) {
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const sendUpdate = async (data: any) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  const processAllPosts = async () => {
    try {
      const supabase = await createClient()
      
      const { count: totalPosts, error: countError } = await supabase
        .from('content_post')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        throw new Error(`Failed to get post count: ${countError.message}`)
      }

      if (!totalPosts) {
        throw new Error('No posts found')
      }

      const results = {
        total: totalPosts,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [] as Array<{ postId: number; error: string; details?: string }>
      }

      const pageSize = 1000
      const batchSize = 5

      for (let offset = 0; offset < totalPosts; offset += pageSize) {
        const { data: posts, error: fetchError } = await supabase
          .from('content_post')
          .select('id, title')
          .range(offset, offset + pageSize - 1)
          .order('id')

        if (fetchError) {
          throw new Error(`Failed to fetch posts: ${fetchError.message}`)
        }

        if (!posts) continue

        for (let i = 0; i < posts.length; i += batchSize) {
          const batch = posts.slice(i, i + batchSize)
          
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
                })

                const result = await indexPost(post.id, supabase)
                results.processed++

                if (result.success) {
                  results.succeeded++
                } else {
                  results.failed++
                  const errorUpdate = {
                    type: 'error',
                    postId: post.id,
                    error: result.error || 'Unknown error',
                    details: result.details
                  }
                  results.errors.push(errorUpdate)
                  await sendUpdate(errorUpdate)
                }

                await sendUpdate({
                  type: 'progress',
                  ...results
                })

              } catch (error) {
                results.processed++
                results.failed++
                const errorUpdate = {
                  type: 'error',
                  postId: post.id,
                  error: error instanceof Error ? error.message : 'Unknown error'
                }
                results.errors.push(errorUpdate)
                await sendUpdate(errorUpdate)
              }
            })
          )

          // Add delay between batches
          if (i + batchSize < posts.length) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }

      await sendUpdate({
        type: 'complete',
        total: results.total,
        succeeded: results.succeeded,
        failed: results.failed,
        errors: results.errors
      })

    } catch (error) {
      await sendUpdate({
        type: 'error',
        postId: 0,
        error: 'Processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      writer.close()
    }
  }

  processAllPosts()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
