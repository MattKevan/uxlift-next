import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import MobileMenuButton from '@/components/MobileMenuButton'
import UserMenuButton from '@/components//UserMenuButton'
import LoginRegisterButtons from '@/components/LoginRegisterButtons'

export default async function Header() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  let profile = null
  if (user && !error) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    profile = data
  }

  return (
    <nav className="font-sans flex items-center  border-y pr-2 sticky top-0 bg-white/80 backdrop-blur-lg dark:bg-gray-950/80 z-50">
      <MobileMenuButton />

      <img src="/uxlift-logo.svg" alt="UX Lift logo" className="size-6 lg:hidden m-4"  />

      <ul className="max-lg:hidden flex flex-row  font-medium border-r">
        <li><a href="/news" className='hover:bg-gray-50 dark:hover:bg-gray-900 p-4 block'>News</a></li>
        <li><a href="/topics"  className='hover:bg-gray-50  dark:hover:bg-gray-900  p-4 block'>Topics</a></li>
        <li><a href="/tools"  className='hover:bg-gray-50  dark:hover:bg-gray-900  p-4 block'>Tools</a></li>
        <li><a href="/courses"  className='hover:bg-gray-50  dark:hover:bg-gray-900  p-4 block'>Courses</a></li>
        <li><a href="/newsletter"  className='hover:bg-gray-50  dark:hover:bg-gray-900  p-4 block'>Newsletter</a></li>
      </ul>
      
      <div className="flex-1" />
      
      {user && profile ? (
        <UserMenuButton user={user} profile={profile} />
      ) : (
        <LoginRegisterButtons />
      )}
    </nav>
  )
}
