import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/ProfileForm'
import type { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['user_profiles']['Row']
type UserTopic = Database['public']['Tables']['content_user_topics']['Row']

type ProfileWithTopics = Profile & {
  topics: Pick<UserTopic, 'topic_id'>[]
}

export default async function EditProfilePage() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) {
    redirect('/sign-in')
  }

  // Get existing profile with topics
  const { data: profile } = await supabase
    .from('user_profiles')
    .select(`
      *,
      topics:content_user_topics(
        topic_id
      )
    `)
    .eq('user_id', session.user.id)
    .single() as { data: ProfileWithTopics | null }

  if (!profile) {
    redirect('/profile/create')
  }

  // Format topics into array of IDs for the form
  const selectedTopics = profile.topics?.map((t: { topic_id: number }) => t.topic_id) || []

  return (
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          Edit Profile
        </h1>
      </div>
      <div className="max-w-2xl mx-auto px-6">
        <ProfileForm 
          profile={profile} 
          userId={session.user.id}
          initialTopics={selectedTopics}
        />
      </div>
    </main>
  )
}
