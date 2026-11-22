import { Suspense } from 'react'
import { createPublicClient } from '@/utils/supabase/public'
import PaginatedContentGrid from '@/components/PaginatedContentGrid'

export const revalidate = false

const PAGE_SIZE = 24

export default async function NewsletterPage() {
  const supabase = createPublicClient()

  const { data: posts, count } = await supabase
    .from('newsletter_posts')
    .select('id, slug, title, subtitle, thumbnail_url, publish_date', { count: 'exact' })
    .eq('status', 'confirmed')
    .order('publish_date', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0

  return (
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          Newsletter <br/><span className="text-gray-500">A roundup of the best UX news, articles, tools and other fun stuff, every two weeks.</span>
        </h1>
      </div>

      <h2 className="text-lg font-bold pl-6 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">
        {count ?? 0} editions
      </h2>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-48 animate-pulse border-b border-r bg-gray-100/60 dark:bg-gray-900/60"
              />
            ))}
          </div>
        }
      >
        <PaginatedContentGrid
          kind="newsletter"
          initialItems={posts ?? []}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          basePath="/newsletter"
        />
      </Suspense>
    </main>
  )
}
