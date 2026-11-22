// app/api/fetch-url/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import {
  dispatchRepositoryEvent,
  isGitHubWorkflowAvailable,
} from '@/utils/github-dispatch'
import { logger, logApiRequest, logApiError } from '@/utils/logger'
import { checkSubmitContentRateLimit } from '@/utils/simple-rate-limit'
import { validateApiRequest, fetchUrlRequestSchema } from '@/utils/validation'

const PROCESSING_TITLE = 'Processing submission...'
const PROCESSING_ERROR = 'Processing failed. Please try again.'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkSubmitContentRateLimit(request)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      logger.error('Authentication failed in fetch-url', authError)
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to submit content' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const { url } = validateApiRequest(fetchUrlRequestSchema, body, '/api/fetch-url')
    const normalizedUrl = new URL(url).toString()

    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      logger.error('User profile not found', profileError, { userId: user.id })
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    logApiRequest('POST', '/api/fetch-url', user.id)
    logger.info('Queueing URL for content submission', {
      url: normalizedUrl,
      userProfileId: userProfile.id,
    })

    const workflowAvailable = await isGitHubWorkflowAvailable('process-submission.yml')
    if (!workflowAvailable) {
      return NextResponse.json(
        {
          error:
            'Submissions are temporarily unavailable while background processing is being set up.',
        },
        { status: 503 },
      )
    }

    const { data: existing } = await supabase
      .from('content_post')
      .select('*')
      .eq('link', normalizedUrl)
      .maybeSingle()

    let postId: number | null = null

    if (existing) {
      const isOwner = existing.user_id === userProfile.id

      if (existing.status === 'processing') {
        if (!isOwner) {
          return NextResponse.json(
            { error: 'This URL is already being processed.' },
            { status: 409 },
          )
        }

        return NextResponse.json(
          { success: true, status: 'processing', postId: existing.id },
          { status: 202 },
        )
      }

      if (existing.status === 'published') {
        return NextResponse.json({
          success: true,
          status: 'complete',
          post: existing,
        })
      }

      if (existing.status === 'draft') {
        if (!isOwner) {
          return NextResponse.json(
            { error: 'This URL has already been submitted.' },
            { status: 409 },
          )
        }

        return NextResponse.json({
          success: true,
          status: 'complete',
          post: existing,
        })
      }

      if (!isOwner) {
        return NextResponse.json(
          { error: 'This URL has already been submitted.' },
          { status: 409 },
        )
      }

      // A previous attempt by this user failed; queue it again using the same row.
      const { data: requeued, error: requeueError } = await supabase
        .from('content_post')
        .update({
          title: PROCESSING_TITLE,
          summary: '',
          status: 'processing',
          date_created: new Date().toISOString(),
          user_id: userProfile.id,
        })
        .eq('id', existing.id)
        .select('id')
        .single()

      if (requeueError || !requeued) {
        throw new Error(`Failed to requeue submission: ${requeueError?.message}`)
      }

      postId = requeued.id
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('content_post')
        .insert([{
          title: PROCESSING_TITLE,
          description: '',
          summary: '',
          content: null,
          image_path: null,
          link: normalizedUrl,
          date_created: new Date().toISOString(),
          date_published: null,
          status: 'processing',
          indexed: false,
          user_id: userProfile.id,
        }])
        .select('id')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          const { data: concurrent } = await supabase
            .from('content_post')
            .select('id')
            .eq('link', normalizedUrl)
            .maybeSingle()

          if (concurrent) {
            return NextResponse.json(
              { success: true, status: 'processing', postId: concurrent.id },
              { status: 202 },
            )
          }
        }

        throw new Error(`Failed to create submission: ${insertError.message}`)
      }

      postId = inserted.id
    }

    try {
      await dispatchRepositoryEvent('fetch_url', {
        url: normalizedUrl,
        user_id: userProfile.id,
        post_id: postId,
      })
    } catch (dispatchError) {
      logApiError('POST', '/api/fetch-url', dispatchError as Error)

      await supabase
        .from('content_post')
        .update({ status: 'error', summary: PROCESSING_ERROR })
        .eq('id', postId)

      return NextResponse.json(
        { error: 'Could not queue content processing. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { success: true, status: 'processing', postId },
      { status: 202 },
    )
  } catch (error) {
    logApiError('POST', '/api/fetch-url', error as Error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to queue URL. Please try again.',
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to check a submission' },
        { status: 401 },
      )
    }

    const postId = Number(new URL(request.url).searchParams.get('postId'))
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: 'Invalid postId' }, { status: 400 })
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const { data: post, error } = await supabase
      .from('content_post')
      .select('*')
      .eq('id', postId)
      .eq('user_id', userProfile.id)
      .single()

    if (error || !post) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    if (post.status === 'processing') {
      return NextResponse.json(
        { success: true, status: 'processing', postId },
        { status: 202 },
      )
    }

    if (post.status === 'error') {
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: post.summary || PROCESSING_ERROR,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      status: 'complete',
      post,
    })
  } catch (error) {
    logApiError('GET', '/api/fetch-url', error as Error)
    return NextResponse.json(
      { error: 'Failed to check submission' },
      { status: 500 },
    )
  }
}
