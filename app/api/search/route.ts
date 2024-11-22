// /app/api/search/route.ts
import { createClient } from '@/utils/supabase/server'
import { OpenAI } from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

interface DocumentMatch {
  id: number
  content: string
  metadata: {
    post_id: number
    title: string
    link: string
  }
  similarity: number
}

export async function POST(request: Request) {
  let query: string = '';
  
  try {
    const body = await request.json();
    query = body.query;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()


    // Generate embedding for search query
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    })

    let documents: DocumentMatch[] | null = null
    let summaryText: string | null = null

    // First try with stricter threshold
    try {
      const { data: strictResults, error } = await supabase
        .rpc('match_documents_optimized', {
          query_embedding: embedding.data[0].embedding,
          match_count: 12,
          similarity_threshold: 0.7
        }) as { data: DocumentMatch[] | null, error: any }

      if (!error && strictResults && strictResults.length > 0) {
        documents = strictResults
      }
    } catch (firstTryError) {
      console.log('First attempt failed, trying with relaxed parameters...')
    }

    // If first try failed, try with relaxed parameters
    if (!documents) {
      const { data: relaxedResults, error } = await supabase
        .rpc('match_documents_optimized', {
          query_embedding: embedding.data[0].embedding,
          match_count: 3,
          similarity_threshold: 0.5
        }) as { data: DocumentMatch[] | null, error: any }

      if (error) {
        throw error
      }

      documents = relaxedResults
    }

    if (!documents || documents.length === 0) {
      // Save failed search attempt
      await supabase.from('search_history').insert({
        query: query.trim(),
        user_id: user?.id || null,
        total_results: 0,
        summary: null
      })

      return NextResponse.json(
        { error: 'No results found' },
        { status: 404 }
      )
    }

    const contextText = documents
      .map((doc: DocumentMatch) => `${doc.content}`)
      .join('\n\n')
      .slice(0, 2000)

    const summary = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use four sentences maximum and keep the answer concise."
        },
        {
          role: "user",
          content: `Query: "${query}"\n\nContext:\n${contextText}\n\nProvide a brief summary of how these results relate to the query.`
        }
      ],
      temperature: 0,
      max_tokens: 150
    })

    summaryText = summary.choices[0].message.content

    // Save successful search
    await supabase.from('search_history').insert({
      query: query.trim(),
      summary: summaryText,
      total_results: documents.length,
      user_id: user?.id || null
    })

    return NextResponse.json({
      results: documents,
      summary: summaryText
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    
    // Only try to save failed search if we have a query
    if (query) {
      try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        
        await supabase.from('search_history').insert({
          query: query.trim(),
          user_id: user?.id || null,
          total_results: 0,
          summary: null
        })
      } catch (dbError) {
        console.error('Failed to save failed search:', dbError)
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
