// /app/api/reset-index-status/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('content_post')
      .update({ indexed: false })
      .neq('id', 0); // Update all posts

    if (error) {
      return NextResponse.json(
        { error: 'Failed to reset index status', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
