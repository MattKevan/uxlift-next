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
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Generate embedding for search query
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    })

    // First try with a stricter threshold and fewer results
    try {
      const { data: documents, error } = await supabase
        .rpc('match_documents_optimized', {
          query_embedding: embedding.data[0].embedding,
          match_count: 12,
          similarity_threshold: 0.7
        }) as { data: DocumentMatch[] | null, error: any }

      if (!error && documents && documents.length > 0) {
        // If we got results, proceed with these
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

        return NextResponse.json({
          results: documents,
          summary: summary.choices[0].message.content
        })
      }
    } catch (firstTryError) {
      console.log('First attempt failed, trying with relaxed parameters...')
    }

    // If first try failed or returned no results, try with relaxed parameters
    const { data: documents, error } = await supabase
      .rpc('match_documents_optimized', {
        query_embedding: embedding.data[0].embedding,
        match_count: 3,
        similarity_threshold: 0.5
      }) as { data: DocumentMatch[] | null, error: any }

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json(
        { error: 'Search failed', details: error.message },
        { status: 500 }
      )
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No results found' },
        { status: 404 }
      )
    }

    const contextText = documents
      .map((doc: DocumentMatch) => `${doc.content}`)
      .join('\n\n')
      .slice(0, 1500)

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

    return NextResponse.json({
      results: documents,
      summary: summary.choices[0].message.content
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
