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
          <div>
      { profile.name ? (
        <div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {profile.name}
        </h1>
        
          </div>
      ) : (
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          @{profile.username}
        </h1>
      )}
      { profile.role && (
      <p className="text-gray-500 text-4xl md:text-5xl font-bold tracking-tight">
           {profile.role}
          </p>
      )}
      <p className="text-gray-500 text-4xl md:text-5xl font-bold tracking-tight flex gap-3 mb-4 lg:mb-0">
      
      <a href={profile.website} target="_blank" className='hover:underline'>Website</a>
      <a href={profile.linkedin} target="_blank" className='hover:underline'>LinkedIn</a>
      <a href={`https://bsky.app/profile/${profile.bluesky}`} target="_blank"  className='hover:underline'>Bluesky</a>


      </p>
      </div>
      <div>
            <Button href='/profile/edit' outline>Edit profile</Button>
      </div>
      </div>

      </div>
    </div>


        

        {profile.biography && (
          <div>
                <h2  className="text-lg font-bold pl-6 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">About</h2>

          <div className="mb-6  pt-4 pl-4 pb-6 border-b">
      <p className="whitespace-pre-wrap max-w-6xl">{profile.biography}</p>
          </div>
          </div>
        )}

        
    </main>
  )
}
