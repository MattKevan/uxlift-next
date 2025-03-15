import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

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
                <a href="/admin/posts" className="border-b-2 border-transparent hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Posts
                </a>
                <a href="/admin/activity-logs" className="border-b-2 border-transparent hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Activity logs
                </a>
                <a href="/admin/tools" className="border-b-2 border-transparent hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Tools
                </a>
                <a href="/admin/sites" className="border-b-2 border-transparent hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Sites
                </a>
                <a href="/admin/books" className="border-b-2 border-transparent hover:border-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Books
                </a>
                {/* Add more admin navigation items here */}
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="p-4">
        {children}
      </main>
    </div>
  )
}
