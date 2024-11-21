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
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Create Profile</h1>
      <ProfileForm userId={user.id} />
    </div>
  )
}
