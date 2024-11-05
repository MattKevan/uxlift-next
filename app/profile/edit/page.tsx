import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/ProfileForm'

export default async function CreateProfilePage() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) {
    redirect('/login')
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select()
    .eq('user_id', session.user.id)
    .single()

  if (!profile) {
    redirect('/profile/create')
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Profile</h1>
      <ProfileForm profile={profile} userId={session.user.id} />
    </div>
  )
}