import { createClient as createServerClient } from '@/utils/supabase/server'
import { OpenAI } from 'openai'
import { Pinecone, RecordMetadata, QueryOptions } from '@pinecone-database/pinecone'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, NextRequest } from 'next/server'
import { checkSearchRateLimit } from '@/utils/simple-rate-limit'
import { logger } from '@/utils/logger'
import { validateApiRequest, searchRequestSchema } from '@/utils/validation'
import {
  contentLlmClient,
  contentLlmModel,
  contentLlmProvider,
  hasContentLlmCredentials,
} from '@/utils/llm'
import type { Database, Json } from '@/types/supabase'

const embeddingClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const pinecone = new Pinecone()
const index = pinecone.index(process.env.PINECONE_INDEX_NAME || '')

const ANON_SEARCH_COOKIE = 'uxlift_anon_search_used'
const ANON_SEARCH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

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

interface SearchPayloadResult {
  post_id: number
  title: string
  link: string
  similarity: number
  excerpt: string
}

interface SearchHistoryPayload {
  answer: string | null
  results: SearchPayloadResult[]
  error: string | null
}

const createServiceClient = () => createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

function withAnonSearchCookie(response: NextResponse, shouldSetCookie: boolean) {
  if (!shouldSetCookie) {
    return response
  }

  response.cookies.set({
    name: ANON_SEARCH_COOKIE,
    value: '1',
    maxAge: ANON_SEARCH_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}

function buildSearchPayload(answer: string | null, results: DocumentMatch[], error: string | null): SearchHistoryPayload {
  return {
    answer,
    error,
    results: results.map((result) => ({
      post_id: result.metadata.post_id,
      title: result.metadata.title,
      link: result.metadata.link,
      similarity: result.similarity,
      excerpt: result.content.slice(0, 280),
    })),
  }
}

async function saveSearchHistory(
  query: string,
  userId: string | null,
  totalResults: number,
  summary: string | null,
  payload: SearchHistoryPayload
) {
  try {
    const serviceClient = createServiceClient()
    await serviceClient.from('search_history').insert({
      query: query.trim(),
      user_id: userId,
      total_results: totalResults,
      summary,
      result_payload: payload as unknown as Json,
    })
  } catch (error) {
    console.error('Failed to save search history:', error)
  }
}

export async function POST(request: NextRequest) {
  let query = ''
  let userId: string | null = null
  let isAnonymousSearch = false
  let consumeAnonymousSearch = false

  try {
    const rateLimitResponse = await checkSearchRateLimit(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const body = await request.json()
    const validatedData = validateApiRequest(searchRequestSchema, body, '/api/search')
    query = validatedData.query

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id || null
    isAnonymousSearch = !userId

    if (isAnonymousSearch && request.cookies.get(ANON_SEARCH_COOKIE)?.value === '1') {
      return NextResponse.json(
        {
          error: 'Please create an account or sign in to continue searching.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      )
    }

    consumeAnonymousSearch = isAnonymousSearch

    const embedding = await embeddingClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 1536,
      encoding_format: 'float',
    })

    let documents: DocumentMatch[] = []

    const strictQueryOptions: QueryOptions = {
      vector: embedding.data[0].embedding,
      topK: 12,
      includeMetadata: true,
    }

    try {
      const strictResults = await index.query(strictQueryOptions)

      if (strictResults.matches && strictResults.matches.length > 0) {
        documents = strictResults.matches
          .filter((match) => (match.score || 0) >= 0.75)
          .map((match) => ({
            id: match.id,
            content: (match.metadata as PineconeMetadata).content,
            metadata: {
              post_id: (match.metadata as PineconeMetadata).post_id,
              title: (match.metadata as PineconeMetadata).title,
              link: (match.metadata as PineconeMetadata).link,
            },
            similarity: match.score || 0,
          }))
      }
    } catch (firstTryError) {
      console.error('First attempt failed:', firstTryError)
    }

    if (documents.length === 0) {
      const relaxedQueryOptions: QueryOptions = {
        vector: embedding.data[0].embedding,
        topK: 3,
        includeMetadata: true,
      }

      try {
        const relaxedResults = await index.query(relaxedQueryOptions)

        if (relaxedResults.matches) {
          documents = relaxedResults.matches
            .filter((match) => (match.score || 0) >= 0.6)
            .map((match) => ({
              id: match.id,
              content: (match.metadata as PineconeMetadata).content,
              metadata: {
                post_id: (match.metadata as PineconeMetadata).post_id,
                title: (match.metadata as PineconeMetadata).title,
                link: (match.metadata as PineconeMetadata).link,
              },
              similarity: match.score || 0,
            }))
        }
      } catch (secondTryError) {
        console.error('Second attempt failed:', secondTryError)
      }
    }

    if (documents.length === 0) {
      await saveSearchHistory(
        query,
        userId,
        0,
        null,
        buildSearchPayload(null, [], 'No results found')
      )

      return withAnonSearchCookie(
        NextResponse.json({ error: 'No results found' }, { status: 404 }),
        consumeAnonymousSearch
      )
    }

    const contextText = documents
      .map((doc: DocumentMatch) => doc.content)
      .join('\n\n')
      .slice(0, 2000)

    let summaryText: string | null = null
    if (hasContentLlmCredentials) {
      const summary = await contentLlmClient.chat.completions.create({
        model: contentLlmModel,
        messages: [
          {
            role: 'system',
            content: `You are an expert UX design educator. Your role is to provide clear, accurate, and helpful answers about UX design concepts.
When answering questions, follow these guidelines:
- Provide concrete explanations with real-world examples where relevant
- Focus on practical applications and industry best practices
- If the question is about fundamentals (like "What is UX?"), start with a clear definition
- Include key principles or components when explaining concepts
- Keep the tone professional but approachable
- Format your response with Markdown if necessary
- Write it as though you are giving the information, not 'the context...' or 'the query asks...'
Use the provided context to enhance your answer, but also draw from fundamental UX knowledge for basic questions. Do not make things up if you don't know the answer, just say you don't know.`,
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nContext:\n${contextText}\n\nProvide a brief summary of how these results relate to the query.`,
          },
        ],
        temperature: 0,
        max_tokens: 1000,
      })
      summaryText = summary.choices[0]?.message?.content?.trim() || null
    } else {
      logger.warn('Search summary LLM unavailable; returning results without generated answer', {
        provider: contentLlmProvider,
        model: contentLlmModel,
      })
    }

    await saveSearchHistory(
      query,
      userId,
      documents.length,
      summaryText,
      buildSearchPayload(summaryText, documents, null)
    )

    return withAnonSearchCookie(
      NextResponse.json({
        results: documents,
        answer: summaryText,
      }),
      consumeAnonymousSearch
    )
  } catch (error) {
    console.error('Unexpected error:', error)

    if (query) {
      await saveSearchHistory(
        query,
        userId,
        0,
        null,
        buildSearchPayload(null, [], error instanceof Error ? error.message : 'Internal server error')
      )
    }

    return withAnonSearchCookie(
      NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      ),
      consumeAnonymousSearch
    )
  }
}

export async function OPTIONS(_request: Request) {
  return NextResponse.json({}, { status: 200 })
}
