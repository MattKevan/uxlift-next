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
    <div className=' mb-24 sm:mb-32 border-b'>
      <div className='flex'>
        <div className='border-r p-4'>
          <CustomImage
            src={profile.image_url}
            alt={`${profile.username}'s profile picture`}
            width={200}
            height={200}
            className="rounded-full aspect-square"
            fallback="/default-avatar.png"
            provider="cloudinary"
            options={{
              crop: "fill",
              gravity: "face",
              aspectRatio: "1:1"
            }}
          />
        </div>
        <div className='p-4 flex-grow flex flex-col justify-between'>
      { profile.name ? (
        <div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {profile.name}
        </h1>
        <p className="text-gray-500 text-3xl font-bold tracking-tight">
           @{profile.username}
          </p>
          </div>
      ) : (
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          @{profile.username}
        </h1>
      )}
      <div>
            <Button href='/profile/edit' className='block'>Edit profile</Button>
      </div>
      </div>

      </div>
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
        <div className="shadow rounded-lg p-6 space-y-6">
        {profile.role && (
          <div className="mb-4">
            <label className="font-medium">Current Role</label>
            <p>{profile.role}</p>
            </div>
        )}

        {profile.biography && (
          <div className="mb-4">
            <label className="font-medium">About</label>
            <p className="whitespace-pre-wrap">{profile.biography}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="font-medium">Username</label>
            <p>{profile.username}</p>
          </div>

          <div className="mb-4">
            <label className="font-medium">Name</label>
            <p>{profile.name || 'Not provided'}</p>
          </div>

          {profile.website && (
            <div className="mb-4">
              <label className="font-medium">Website</label>
              <p><a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{profile.website}</a></p>
            </div>
          )}

          {profile.linkedin && (
            <div className="mb-4">
              <label className="font-medium">LinkedIn</label>
              <p><a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Profile</a></p>
            </div>
          )}

          {profile.bluesky && (
            <div className="mb-4">
              <label className="font-medium">Bluesky</label>
              <p><a href={`https://bsky.app/profile/${profile.bluesky}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{profile.bluesky}</a></p>
            </div>
          )}

          <div className="mb-4">
            <label className="font-medium">Member since</label>
            <p>{new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
      </div>
    </main>
  )
}
