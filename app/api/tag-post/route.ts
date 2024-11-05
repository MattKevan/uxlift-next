import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { tagPost } from '@/utils/post-tools/tag-posts'

export async function POST(request: Request) {
    
  try {
    const { postId } = await request.json()
    const supabase = await createClient()

    const result = await tagPost(postId, supabase)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
