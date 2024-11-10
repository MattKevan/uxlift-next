import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { processFeedItems } from '@/utils/post-tools/process-feeds'
import type { Database } from '@/types/supabase'

// Verify the request is either from Vercel Cron or an authenticated admin
const validateRequest = async (request: Request) => {
  const authHeader = request.headers.get('authorization')
  
  // If it's a cron job request
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // If it's an admin request, verify the session
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    throw new Error('Unauthorized');
  }

  // Check if user has admin privileges in user_profiles table
  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', session.user.id)
    .single();

  if (profileError || !userProfile || !userProfile.is_admin) {
    throw new Error('Unauthorized: Admin privileges required');
  }

  return true;
}

export async function GET(request: Request) {
  try {
    // Validate the request (either cron or admin)
    await validateRequest(request)

    // Initialize Supabase client using your server setup
    const supabase = await createClient()

    // Process the feeds
    const result = await processFeedItems(supabase)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Process feeds error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
