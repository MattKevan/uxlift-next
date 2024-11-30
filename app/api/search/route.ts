import { createClient } from '@/utils/supabase/server'
import { OpenAI } from 'openai'
import { Pinecone, RecordMetadata, QueryOptions } from '@pinecone-database/pinecone'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

const pinecone = new Pinecone()
const index = pinecone.index(process.env.PINECONE_INDEX_NAME || '')

interface PineconeMetadata extends RecordMetadata {
  post_id: number
  title: string
  link: string
  content: string
}

interface DocumentMatch {
  id: string
  content: string
  metadata: {
    post_id: number
    title: string
    link: string
  }
  similarity: number
}

export async function POST(request: Request) {
  let query: string = ''
  
  try {
    const body = await request.json()
    query = body.query

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Generate embedding for the search query
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      dimensions: 1536,
      encoding_format: "float"
    })

    let documents: DocumentMatch[] = []

    // Configure query options
    const strictQueryOptions: QueryOptions = {
      vector: embedding.data[0].embedding,
      topK: 12,
      includeMetadata: true,
    }

    // First attempt with stricter threshold
    try {
      const strictResults = await index.query(strictQueryOptions)

      if (strictResults.matches && strictResults.matches.length > 0) {
        // Filter results with score >= 0.75
        documents = strictResults.matches
          .filter(match => (match.score || 0) >= 0.75)
          .map(match => ({
            id: match.id,
            content: (match.metadata as PineconeMetadata).content,
            metadata: {
              post_id: (match.metadata as PineconeMetadata).post_id,
              title: (match.metadata as PineconeMetadata).title,
              link: (match.metadata as PineconeMetadata).link
            },
            similarity: match.score || 0
          }))
      }
    } catch (firstTryError) {
      console.error('First attempt failed:', firstTryError)
    }

    // If no results, try with relaxed parameters
    if (documents.length === 0) {
      const relaxedQueryOptions: QueryOptions = {
        vector: embedding.data[0].embedding,
        topK: 3,
        includeMetadata: true,
      }

      try {
        const relaxedResults = await index.query(relaxedQueryOptions)

        if (relaxedResults.matches) {
          // Filter results with score >= 0.6
          documents = relaxedResults.matches
            .filter(match => (match.score || 0) >= 0.6)
            .map(match => ({
              id: match.id,
              content: (match.metadata as PineconeMetadata).content,
              metadata: {
                post_id: (match.metadata as PineconeMetadata).post_id,
                title: (match.metadata as PineconeMetadata).title,
                link: (match.metadata as PineconeMetadata).link
              },
              similarity: match.score || 0
            }))
        }
      } catch (secondTryError) {
        console.error('Second attempt failed:', secondTryError)
      }
    }

    // If still no results, return 404
    if (documents.length === 0) {
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

    // Prepare context for summary
    const contextText = documents
      .map((doc: DocumentMatch) => doc.content)
      .join('\n\n')
      .slice(0, 2000)

    // Generate summary using GPT-4
    const summary = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert UX design educator. Your role is to provide clear, accurate, and helpful answers about UX design concepts.
When answering questions, follow these guidelines:
- Provide concrete explanations with real-world examples where relevant
- Focus on practical applications and industry best practices
- If the question is about fundamentals (like "What is UX?"), start with a clear definition
- Include key principles or components when explaining concepts
- Keep the tone professional but approachable
- Format your response with Markdown if necessary
- Write it as though you are giving the information, not 'the context...' or 'the query asks...'
Use the provided context to enhance your answer, but also draw from fundamental UX knowledge for basic questions. Do not make things up if you don't know the answer, just say you don't know.`
        },
        {
          role: "user",
          content: `Query: "${query}"\n\nContext:\n${contextText}\n\nProvide a brief summary of how these results relate to the query.`
        }
      ],
      temperature: 0,
      max_tokens: 1000
    })

    const summaryText = summary.choices[0].message.content

  // Log all searches with user_id if available, null if not
  await supabase.from('search_history').insert({
    query: query.trim(),
    summary: summaryText,
    total_results: documents.length,
    user_id: user?.id || null // null for anonymous users
  })

  return NextResponse.json({
    results: documents,
    answer: summaryText
  })

} catch (error) {
  console.error('Unexpected error:', error)
  
  // Log failed searches too
  if (query) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      await supabase.from('search_history').insert({
        query: query.trim(),
        user_id: user?.id || null, // null for anonymous users
        total_results: 0,
        summary: null
      })
    } catch (dbError) {
      console.error('Failed to save failed search:', dbError)
    }
  }

  return NextResponse.json(
    { 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    },
    { status: 500 }
  )
}
}

// Add OPTIONS handler for CORS if needed
export async function OPTIONS(request: Request) {
  return NextResponse.json({}, { status: 200 })
}