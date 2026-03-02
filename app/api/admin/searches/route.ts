import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/supabase'
import type { AdminSearchItem, SavedSearchPayload } from '@/types/admin-searches'

const DEFAULT_PER_PAGE = 50
const MAX_PER_PAGE = 200

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

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    return { error: NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 }) }
  }

  return { userId: user.id }
}

function parsePayload(value: Json | null): SavedSearchPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const answer = typeof candidate.answer === 'string' ? candidate.answer : null
  const error = typeof candidate.error === 'string' ? candidate.error : null
  const resultsValue = candidate.results
  const parsedResults = Array.isArray(resultsValue)
    ? resultsValue
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const result = item as Record<string, unknown>
          if (
            typeof result.post_id !== 'number' ||
            typeof result.title !== 'string' ||
            typeof result.link !== 'string' ||
            typeof result.similarity !== 'number' ||
            typeof result.excerpt !== 'string'
          ) {
            return null
          }

          return {
            post_id: result.post_id,
            title: result.title,
            link: result.link,
            similarity: result.similarity,
            excerpt: result.excerpt,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : []

  return {
    answer,
    error,
    results: parsedResults,
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin()
    if ('error' in adminCheck) {
      return adminCheck.error
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1)
    const perPage = Math.min(
      parsePositiveInt(request.nextUrl.searchParams.get('perPage'), DEFAULT_PER_PAGE),
      MAX_PER_PAGE
    )

    const serviceClient = createServiceClient()
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    const { data, error, count } = await serviceClient
      .from('search_history')
      .select('id, created_at, query, summary, total_results, user_id, result_payload', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    const userIds = Array.from(
      new Set((data || []).map((item) => item.user_id).filter((value): value is string => Boolean(value)))
    )

    const userLookup = new Map<string, string | null>()
    await Promise.all(
      userIds.map(async (userId) => {
        const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(userId)
        if (userError) {
          userLookup.set(userId, null)
          return
        }

        userLookup.set(userId, userData.user?.email || null)
      })
    )

    const searches: AdminSearchItem[] = (data || []).map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      query: item.query,
      summary: item.summary,
      totalResults: item.total_results,
      userId: item.user_id,
      userEmail: item.user_id ? userLookup.get(item.user_id) || null : null,
      resultPayload: parsePayload(item.result_payload),
    }))

    return NextResponse.json({
      searches,
      total: count || 0,
      page,
      perPage,
    })
  } catch (error) {
    console.error('Failed to list admin searches:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list searches' },
      { status: 500 }
    )
  }
}
