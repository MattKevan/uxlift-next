import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient, type User } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { AdminUser } from '@/types/admin-users'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

const DEFAULT_PER_PAGE = 50
const MAX_PER_PAGE = 200

const createServiceClient = () => createClient<Database>(
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

async function listAllAuthUsers(serviceClient: ReturnType<typeof createServiceClient>) {
  const users: User[] = []
  const pageSize = 200
  let page = 1

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: pageSize,
    })

    if (error) throw error

    const batch = data.users || []
    users.push(...batch)

    if (batch.length < pageSize) {
      break
    }

    page += 1
  }

  return users
}

function mapAdminUser(authUser: User, profile?: UserProfile): AdminUser {
  const emailConfirmed = Boolean(authUser.email_confirmed_at || authUser.confirmed_at)

  return {
    userId: authUser.id,
    profileId: profile?.id ?? null,
    username: profile?.username ?? null,
    name: profile?.name ?? null,
    email: authUser.email ?? null,
    emailConfirmed,
    newsletterSubscriber: Boolean(profile?.newsletter_subscriber),
    role: profile?.role ?? null,
    isAdmin: Boolean(profile?.is_admin),
    createdAt: authUser.created_at ?? null,
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

    const [{ data: profiles, error: profilesError }, authUsers] = await Promise.all([
      serviceClient
        .from('user_profiles')
        .select('*'),
      listAllAuthUsers(serviceClient),
    ])

    if (profilesError) {
      throw profilesError
    }

    const profilesByUserId = new Map<string, UserProfile>()
    for (const profile of profiles || []) {
      if (profile.user_id) {
        profilesByUserId.set(profile.user_id, profile)
      }
    }

    const allUsers = authUsers
      .map((authUser) => mapAdminUser(authUser, profilesByUserId.get(authUser.id)))
      .sort((a, b) => {
        const aCreatedAt = a.createdAt ? Date.parse(a.createdAt) : 0
        const bCreatedAt = b.createdAt ? Date.parse(b.createdAt) : 0

        if (aCreatedAt !== bCreatedAt) {
          return bCreatedAt - aCreatedAt
        }

        const aValue = (a.username || a.email || '').toLowerCase()
        const bValue = (b.username || b.email || '').toLowerCase()
        return aValue.localeCompare(bValue)
      })

    const startIndex = (page - 1) * perPage
    const pagedUsers = allUsers.slice(startIndex, startIndex + perPage)

    return NextResponse.json({
      users: pagedUsers,
      total: allUsers.length,
      page,
      perPage,
    })
  } catch (error) {
    console.error('Failed to list admin users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list users' },
      { status: 500 }
    )
  }
}
