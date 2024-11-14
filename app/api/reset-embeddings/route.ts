// /app/api/reset-embeddings/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // First, get the count of embeddings to be deleted
    const { count: embeddingsCount, error: countError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Error counting embeddings:', countError)
      return NextResponse.json(
        { 
          error: 'Failed to count embeddings',
          details: countError.message 
        },
        { status: 500 }
      )
    }

    console.log(`Found ${embeddingsCount} embeddings to delete`)

    // Delete all records from documents table
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .gte('id', 0) // This is more reliable than neq

    if (deleteError) {
      console.error('Error deleting embeddings:', deleteError)
      return NextResponse.json(
        { 
          error: 'Failed to delete embeddings',
          details: deleteError.message 
        },
        { status: 500 }
      )
    }

    // Reset indexed status for all posts
    const { error: updateError } = await supabase
      .from('content_post')
      .update({ indexed: false })
      .gte('id', 0)

    if (updateError) {
      console.error('Error resetting post status:', updateError)
      return NextResponse.json(
        { 
          error: 'Failed to reset post status',
          details: updateError.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedCount: embeddingsCount,
      message: `Successfully deleted ${embeddingsCount} embeddings and reset all posts`
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
