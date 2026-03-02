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

const MAX_VECTOR_CANDIDATES = 80
const MAX_RETURNED_RESULTS = 20
const MIN_SCORE_FLOOR = 0.45
const SCORE_DROP_FROM_BEST = 0.18
const CONTEXT_SOURCES_LIMIT = 12
const SOURCE_EXCERPT_CHARS = 600

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function mapMatchToDocument(match: {
  id: string
  score?: number
  metadata?: RecordMetadata
}): DocumentMatch | null {
  const metadata = match.metadata as PineconeMetadata | undefined
  const postId = metadata?.post_id
  const title = asString(metadata?.title)
  const link = asString(metadata?.link)
  const content = asString(metadata?.content)

  if (typeof postId !== 'number' || !title || !link || !content) {
    return null
  }

  return {
    id: match.id,
    content,
    metadata: {
      post_id: postId,
      title,
      link,
    },
    similarity: match.score || 0,
  }
}

function selectRelevantDocuments(matches: Array<{
  id: string
  score?: number
  metadata?: RecordMetadata
}>): DocumentMatch[] {
  const mapped = matches
    .map(mapMatchToDocument)
    .filter((item): item is DocumentMatch => item !== null)
    .sort((a, b) => b.similarity - a.similarity)

  if (mapped.length === 0) {
    return []
  }

  // Keep one best chunk per article to increase article diversity.
  const byPostId = new Map<number, DocumentMatch>()
  for (const item of mapped) {
    const current = byPostId.get(item.metadata.post_id)
    if (!current || item.similarity > current.similarity) {
      byPostId.set(item.metadata.post_id, item)
    }
  }

  const uniqueByPost = Array.from(byPostId.values()).sort((a, b) => b.similarity - a.similarity)
  const topScore = uniqueByPost[0]?.similarity || 0
  const dynamicFloor = Math.max(MIN_SCORE_FLOOR, topScore - SCORE_DROP_FROM_BEST)

  const filtered = uniqueByPost.filter((item) => item.similarity >= dynamicFloor)
  return filtered.slice(0, MAX_RETURNED_RESULTS)
}

function stripInlineCitations(value: string): string {
  return value
    .replace(/\s*\[\d+\]/g, '')
    .replace(/\[\d+\]\s*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

    const wideQueryOptions: QueryOptions = {
      vector: embedding.data[0].embedding,
      topK: MAX_VECTOR_CANDIDATES,
      includeMetadata: true,
    }

    try {
      const wideResults = await index.query(wideQueryOptions)
      documents = selectRelevantDocuments(wideResults.matches || [])
    } catch (queryError) {
      console.error('Search query failed:', queryError)
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

    const sourcesForAnswer = documents.slice(0, CONTEXT_SOURCES_LIMIT)
    const formattedSources = sourcesForAnswer
      .map((doc, index) => {
        const sourceNumber = index + 1
        return [
          `[${sourceNumber}] ${doc.metadata.title}`,
          `URL: ${doc.metadata.link}`,
          `Relevance: ${doc.similarity.toFixed(3)}`,
          `Excerpt: ${doc.content.slice(0, SOURCE_EXCERPT_CHARS)}`,
        ].join('\n')
      })
      .join('\n\n')

    let summaryText: string | null = null
    if (hasContentLlmCredentials) {
      const baseMessages = [
        {
          role: 'system' as const,
          content: `You are a senior UX educator and practitioner.
Answer the user's question directly using the provided sources as evidence.

Rules:
- Do not say "the query", "the context", "the results", or "the articles" unless explicitly asked.
- Do not include citation markers like [1], [2], or source IDs in the output.
- Start with a direct answer in 1-2 sentences.
- Then add 4-6 concise bullet points with practical guidance.
- If the user asks for recommendations (books, tools, methods), provide a ranked list with one-line reasons.
- If evidence is weak or incomplete, say what is missing instead of guessing.
- Prefer bullet lists. Do not use Markdown tables unless the user asks for a table.`,
        },
        {
          role: 'user' as const,
          content: `User question: "${query}"

Sources:
${formattedSources}

Task:
1) Answer the user question directly.
2) Use only source-backed claims.
3) Keep it concise and actionable.`,
        },
      ]

      const summary = await contentLlmClient.chat.completions.create({
        model: contentLlmModel,
        messages: baseMessages,
        temperature: 0,
        max_tokens: 1200,
      })

      let text = summary.choices[0]?.message?.content?.trim() || ''

      // If the response was cut off, ask for a complete concise rewrite.
      if (summary.choices[0]?.finish_reason === 'length') {
        const retry = await contentLlmClient.chat.completions.create({
          model: contentLlmModel,
          messages: [
            ...baseMessages,
            {
              role: 'user',
              content: 'Your previous answer was cut off. Rewrite it fully in under 220 words and finish cleanly.',
            },
          ],
          temperature: 0,
          max_tokens: 600,
        })
        text = retry.choices[0]?.message?.content?.trim() || text
      }

      summaryText = text ? stripInlineCitations(text) : null
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
