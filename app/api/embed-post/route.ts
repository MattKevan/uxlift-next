// /app/api/embed-post/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { embedPost } from '@/utils/post-tools/embed-post'

export async function POST(request: Request) {
  try {
    const { postId } = await request.json()
    const supabase = await createClient()

    const result = await embedPost(postId, supabase)

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
