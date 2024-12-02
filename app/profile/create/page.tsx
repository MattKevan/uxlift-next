import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/ProfileForm'

export default async function CreateProfilePage() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/sign-in')
  }

  // Check if user already has a profile
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select()
    .eq('user_id', user.id)
    .single()

  if (existingProfile) {
    redirect(`/profile/${existingProfile.username}`)
  }

  return (
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          Create your profile
        </h1>
      </div>
      <h2 id="details" className="text-lg font-bold px-4 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">About you</h2>

      <div className="">
        <ProfileForm 
          userId={user.id}
        />
      </div>
    </main>
  )
}
