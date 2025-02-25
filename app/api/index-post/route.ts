// /app/api/index-post/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { indexPost } from '@/utils/post-tools/index-posts'

export async function POST(request: Request) {
  try {
    const { postId } = await request.json()
    const supabase = await createClient()

    const result = await indexPost(postId, supabase)

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
