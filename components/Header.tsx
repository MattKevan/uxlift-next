import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Avatar } from '@/components/catalyst/avatar'
import { MobileNav } from '@/components/MobileNav'
import UserMenuButton from './UserMenuButton'
import LoginRegisterButtons from './LoginRegisterButtons'

const menuItems = [
  { href: '/news', label: 'News' },
  { href: '/topics', label: 'Topics' },
  { href: '/tools', label: 'Tools' },
  { href: '/newsletter', label: 'Newsletter' },
]

const moreItems = [
  {
    href: '/books',
    label: 'Books',
    description: 'Curated collection of UX and design books.'
  },
  {
    href: '/publications',
    label: 'Publications',
    description: 'Leading UX and design publications.'
  },
  {
    href: '/team',
    label: 'Team Account',
    description: 'Collaborate and share resources with your team.'
  },
]

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
    <header className="lg:ml-[60px] border-y bg-white/80 backdrop-blur-lg dark:bg-gray-950/80 sticky top-0 z-50">
      <nav className="flex items-center  ">
        {/* Mobile Navigation */}
        <div className="lg:hidden flex items-center">
          <MobileNav items={menuItems} moreItems={moreItems} />
          <Link href="/" className="p-4">
            <img src="/uxlift-logo.svg" alt="UX Lift logo" className="h-6 w-6" />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <ul className="hidden lg:flex items-center">
          {menuItems.map((item) => (
            <li key={item.href}>
              <Link 
                href={item.href} 
                className="p-4  inline-block  hover:bg-accent transition-colors"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="relative group">
            <button 
              className="p-4  hover:bg-accent transition-colors flex items-center gap-1"
            >
              More
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="absolute hidden group-hover:block w-[200px] top-full left-0 bg-background border shadow-lg">
              <div className="grid grid-cols-1">
                {moreItems.map((item) => (
                  <Link 
                    key={item.href}
                    href={item.href} 
                    className="block px-4 py-3 hover:bg-accent"
                  >
                    <div className="">{item.label}</div>
                  </Link>
                ))}
              </div>
            </div>
          </li>
        </ul>

        {/* User Navigation */}
        <div className="ml-auto flex items-center gap-4">
        {user && profile ? (
        <UserMenuButton user={user} profile={profile} />
      ) : (
        <LoginRegisterButtons />
      )}
        </div>
      </nav>
    </header>
  )
}
