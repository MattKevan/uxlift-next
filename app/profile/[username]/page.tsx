import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import type { Database } from '@/types/supabase'
import { CustomImage } from '@/components/Image'
import { Button } from '@/components/catalyst/button'

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
    <main>
    <div className='px-6 mb-24 sm:mb-32 mt-6'>
    <CustomImage
            src={profile.avatar_url}
            alt={`${profile.username}'s profile picture`}
            width={100}
            height={100}
            className="rounded-full"
            fallback=" /default-avatar.png"
            provider="default"
          />
      { profile.name ? (
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          {profile.name}
          <span className="text-gray-500 ml-2">
           @{profile.username}
            </span>
          </h1>
      ) : (
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
        @{profile.username}
       </h1>
      )}
      <Button href='/profile/edit'>Edit profile</Button>
      </div>
      <div className="shadow rounded-lg p-6">
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
    </main>
  )
}
