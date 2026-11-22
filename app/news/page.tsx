// /app/news/page.tsx

import { Suspense } from 'react'
import { createPublicClient } from '@/utils/supabase/public'
import PaginatedPostGrid from '@/components/posts/PaginatedPostGrid'
import { normalizePost } from '@/lib/content/post-shape'

export const revalidate = false

const PAGE_SIZE = 20

export default async function NewsPage() {
  const supabase = createPublicClient()

  const { data: rawPosts, count } = await supabase
    .from('content_post')
    .select(`
      id,
      slug,
      title,
      description,
      date_published,
      link,
      image_path,
      site:content_site!left (
        title,
        slug,
        site_icon
      ),
      content_post_topics!left (
        topic:content_topic!left (
          id,
          name,
          slug
        )
      )
    `, { count: 'exact' })
    .eq('status', 'published')
    .order('date_published', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  const posts = (rawPosts ?? []).map(normalizePost)
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0

  return (
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          Latest news, <span className="text-gray-500">updated daily.</span>
        </h1>
      </div>
      <h2 className="text-lg font-bold pl-6 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">
        {count ?? 0} UX articles
      </h2>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 border-b">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse border-b bg-gray-100/60 dark:bg-gray-900/60"
              />
            ))}
          </div>
        }
      >
        <PaginatedPostGrid
          source={{ kind: 'news' }}
          initialPosts={posts}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          basePath="/news"
        />
      </Suspense>
    </main>
  )
}
