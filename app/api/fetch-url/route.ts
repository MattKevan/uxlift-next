import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { fetchAndProcessContent } from '@/utils/post-tools/fetch-content'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const supabase = await createClient()
    
    const post = await fetchAndProcessContent(url, supabase)
    
    return NextResponse.json({ post })
  } catch (error) {
    console.error('Error processing URL:', error)
    return NextResponse.json(
      { error: 'Failed to process URL', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
