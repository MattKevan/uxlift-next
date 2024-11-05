import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { processFeedItems } from '@/utils/post-tools/process-feeds'
import type { Database } from '@/types/supabase'

// Verify the request is from Vercel Cron
const validateCronRequest = (request: Request) => {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new Error('Unauthorized')
  }
}

export async function GET(request: Request) {
  try {
    // Validate the request
    validateCronRequest(request)

    // Initialize Supabase client using your server setup
    const supabase = await createClient()

    // Process the feeds
    const result = await processFeedItems(supabase)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
