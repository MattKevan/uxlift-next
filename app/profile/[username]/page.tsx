import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import type { Database } from '@/types/supabase'

type Params = Promise<{ username: string }>
type SearchParams = Promise<{ page?: string }>

interface PageProps {
  params: Params
  searchParams: SearchParams
}

export default async function ProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { username } = await params  // Await the params
  const { page } = await searchParams  // Await the searchParams
  
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profile) {
    notFound()
  }


  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <label className="font-medium">Username</label>
          <p>{profile.username}</p>
        </div>
        <div className="mb-4">
          <label className="font-medium">Name</label>
          <p>{profile.name || 'Not provided'}</p>
        </div>
        <div className="mb-4">
          <label className="font-medium">Member since</label>
          <p>{new Date(profile.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}
