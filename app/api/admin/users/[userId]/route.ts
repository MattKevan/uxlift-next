import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient, type User } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { AdminUser, AdminUserUpdatePayload } from '@/types/admin-users'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

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

async function getAuthUser(serviceClient: ReturnType<typeof createServiceClient>, userId: string) {
  const { data, error } = await serviceClient.auth.admin.getUserById(userId)
  if (error) throw error
  return data.user
}

function normalizePayload(body: unknown): AdminUserUpdatePayload | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const candidate = body as Record<string, unknown>
  const username = typeof candidate.username === 'string' ? candidate.username.trim() : ''
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
  const email = typeof candidate.email === 'string' ? candidate.email.trim() : ''
  const role = typeof candidate.role === 'string' ? candidate.role.trim() : ''
  const isAdmin = candidate.isAdmin
  const newsletterSubscriber = candidate.newsletterSubscriber

  if (!username || !email) return null
  if (typeof isAdmin !== 'boolean' || typeof newsletterSubscriber !== 'boolean') return null

  return {
    username,
    name,
    email,
    role,
    isAdmin,
    newsletterSubscriber,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCheck = await requireAdmin()
    if ('error' in adminCheck) {
      return adminCheck.error
    }

    const { userId } = await params
    const body = await request.json()
    const payload = normalizePayload(body)

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid payload: username, email, isAdmin and newsletterSubscriber are required' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()
    const existingAuthUser = await getAuthUser(serviceClient, userId)

    if (!existingAuthUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if ((existingAuthUser.email || '') !== payload.email) {
      const { error: emailError } = await serviceClient.auth.admin.updateUserById(userId, {
        email: payload.email,
      })
      if (emailError) {
        throw emailError
      }
    }

    const { data: existingProfile, error: existingProfileError } = await serviceClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingProfileError) {
      throw existingProfileError
    }

    if (existingProfile) {
      const { error: updateProfileError } = await serviceClient
        .from('user_profiles')
        .update({
          username: payload.username,
          name: payload.name || null,
          role: payload.role || null,
          is_admin: payload.isAdmin,
          newsletter_subscriber: payload.newsletterSubscriber,
        })
        .eq('user_id', userId)

      if (updateProfileError) {
        throw updateProfileError
      }
    } else {
      const { error: insertProfileError } = await serviceClient
        .from('user_profiles')
        .insert({
          user_id: userId,
          username: payload.username,
          name: payload.name || null,
          role: payload.role || null,
          is_admin: payload.isAdmin,
          newsletter_subscriber: payload.newsletterSubscriber,
          newsletter_pending: false,
        })

      if (insertProfileError) {
        throw insertProfileError
      }
    }

    const [updatedAuthUser, updatedProfileResponse] = await Promise.all([
      getAuthUser(serviceClient, userId),
      serviceClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
    ])

    if (updatedProfileResponse.error) {
      throw updatedProfileResponse.error
    }

    if (!updatedAuthUser) {
      return NextResponse.json({ error: 'User not found after update' }, { status: 404 })
    }

    return NextResponse.json({
      user: mapAdminUser(updatedAuthUser, updatedProfileResponse.data || undefined),
    })
  } catch (error) {
    console.error('Failed to update admin user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCheck = await requireAdmin()
    if ('error' in adminCheck) {
      return adminCheck.error
    }

    const { userId } = await params
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (adminCheck.userId === userId) {
      return NextResponse.json({ error: 'You cannot delete your own account from this screen' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { error } = await serviceClient.auth.admin.deleteUser(userId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete admin user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete user' },
      { status: 500 }
    )
  }
}
