// app/api/fetch-url/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { fetchAndProcessContent } from '@/utils/post-tools/fetch-content'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to submit content' }, 
        { status: 401 }
      )
    }

    // Parse request body
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      console.error('Profile error:', profileError)
      return NextResponse.json(
        { error: 'User profile not found' }, 
        { status: 404 }
      )
    }

    console.log('Processing URL:', url, 'for user profile:', userProfile.id)

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
    console.error('Route error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
