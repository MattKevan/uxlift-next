import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const adminLinks = [
  { href: '/admin/posts', label: 'Posts' },
  { href: '/admin/newsletter', label: 'Newsletter' },
  { href: '/admin/activity-logs', label: 'Activity logs' },
  { href: '/admin/tools', label: 'Tools' },
  { href: '/admin/topics', label: 'Topics' },
  { href: '/admin/resources', label: 'Resources' },
  { href: '/admin/sites', label: 'Sites' },
  { href: '/admin/books', label: 'Books' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  // Double-check admin status
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/')
  }

  return (
    <div className="">
      <nav className="bg-white border-b">
        <div className="px-4">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold">Admin</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {adminLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="border-b-2 border-transparent hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="sm:hidden flex gap-2 overflow-x-auto pb-3">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      
      <main className="p-4">
        {children}
      </main>
    </div>
  )
}
