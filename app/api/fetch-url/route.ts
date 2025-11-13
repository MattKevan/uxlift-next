// app/api/fetch-url/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { fetchAndProcessContent } from '@/utils/post-tools/fetch-content'
import { logger, logApiRequest, logApiError } from '@/utils/logger'
import { checkSubmitContentRateLimit } from '@/utils/simple-rate-limit'
import { validateApiRequest, fetchUrlRequestSchema } from '@/utils/validation'

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const rateLimitResponse = await checkSubmitContentRateLimit(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      logger.error('Authentication failed in fetch-url', authError)
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to submit content' }, 
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { url } = validateApiRequest(fetchUrlRequestSchema, body, '/api/fetch-url')

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      logger.error('User profile not found', profileError, { userId: user.id })
      return NextResponse.json(
        { error: 'User profile not found' }, 
        { status: 404 }
      )
    }

    logApiRequest('POST', '/api/fetch-url', user.id)
    logger.info('Processing URL for content submission', { url, userProfileId: userProfile.id })

    // Process content with user ID
    const post = await fetchAndProcessContent(url, supabase, {
      user_id: userProfile.id,
      status: 'draft'
    })
    
    if (!post) {
      return NextResponse.json(
        { error: 'Failed to process content' }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true,
      post 
    })

  } catch (error) {
    logApiError('POST', '/api/fetch-url', error as Error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process URL. Please try again.'
      },
      { status: 500 }
    )
  }
}
