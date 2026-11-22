import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { fetchAndProcessContent } from '@/utils/post-tools/fetch-content'
import type { Database } from '@/types/supabase'

function fail(message: string): never {
  console.error(`[process-submission] ${message}`)
  process.exit(1)
}

async function main() {
  const url = (process.env.SUBMISSION_URL || process.argv[2] || '').trim()
  const userId = Number(process.env.SUBMISSION_USER_ID || process.argv[3])
  const postId = Number(process.env.SUBMISSION_POST_ID || process.argv[4])

  if (!url) fail('Missing SUBMISSION_URL')
  if (!Number.isInteger(userId) || userId <= 0) fail('Missing or invalid SUBMISSION_USER_ID')
  if (!Number.isInteger(postId) || postId <= 0) fail('Missing or invalid SUBMISSION_POST_ID')

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    fail('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // Turn the queued placeholder into the real draft. fetchAndProcessContent
    // updates this row in place because we pass postId.
    const post = await fetchAndProcessContent(url, supabase, {
      user_id: userId,
      status: 'draft',
      postId,
    })

    if (!post) {
      throw new Error('Content processing returned no post')
    }

    console.log(`[process-submission] completed post ${post.id}: ${post.title}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[process-submission] failed: ${message}`)

    await supabase
      .from('content_post')
      .update({
        status: 'error',
        summary: `Processing failed: ${message}`.slice(0, 1000),
      })
      .eq('id', postId)

    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
