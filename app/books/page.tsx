// /app/books/page.tsx

import { Suspense } from 'react'
import { createPublicClient } from '@/utils/supabase/public'
import PaginatedContentGrid from '@/components/PaginatedContentGrid'

export const revalidate = false

const PAGE_SIZE = 24

export default async function BooksPage() {
  const supabase = createPublicClient()

  const { data: books, count } = await supabase
    .from('content_book')
    .select(`
      id,
      title,
      slug,
      description,
      authors,
      publisher,
      link,
      image_path,
      free,
      status,
      topics:content_book_topics(
        topic:topic_id(
          id,
          name,
          slug
        )
      )
    `, { count: 'exact' })
    .eq('status', 'published')
    .order('title', { ascending: true }) // Changed from date_published to title
    .range(0, PAGE_SIZE - 1)

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0

  return (
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          UX Books <span className="text-gray-500">library</span>
        </h1>
      </div>

      <h2 className=" font-bold p-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">
        {count ?? 0} books
      </h2>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
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
          kind="books"
          initialItems={books ?? []}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          basePath="/books"
        />
      </Suspense>
    </main>
  )
}
