// /app/books/page.tsx

import { createClient } from '@/utils/supabase/server'
import {
  Pagination,
  PaginationPrevious, 
  PaginationNext,
  PaginationList,
  PaginationPage,
  PaginationGap,
} from '@/components/catalyst/pagination'
import { CldImage } from 'next-cloudinary'
import { BookCard } from '@/components/BookCards'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ page?: string }>

interface PageProps {
  params: Params
  searchParams: SearchParams
}

interface Book {
  id: number
  title: string
  description: string
  image_path: string | null
  link: string
  date_created: string
  date_published: string | null
  free: boolean
  status: string
  authors: string
  publisher: string
  summary: string | null
}

export default async function BooksPage({
  params,
  searchParams,
}: PageProps) {
  const { page } = await searchParams
  await params

  const currentPage = Number(page) || 1
  const pageSize = 24
  const startIndex = (currentPage - 1) * pageSize

  const supabase = await createClient()

  const { data: books, count } = await supabase
    .from('content_book')
    .select(`
      *,
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
    .range(startIndex, startIndex + pageSize - 1)

  const totalPages = count ? Math.ceil(count / pageSize) : 0

  const getVisiblePages = () => {
    const delta = 2
    const range: (number | 'gap')[] = []
    
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        range.push(i)
      } else if (
        i === currentPage - delta - 1 || 
        i === currentPage + delta + 1
      ) {
        range.push('gap')
      }
    }
    
    return range
  }

  const visiblePages = getVisiblePages()

  return (
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          UX Books <span className="text-gray-500">library</span>
        </h1>
      </div>

      <h2 className=" font-bold p-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[58px] pb-4 border-b z-40">
        {count} books
      </h2>

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 '>
  {books?.map((book) => (
    <BookCard key={book.id} book={book} />
  ))}
</div>

      {totalPages > 1 && (
        <Pagination className="p-4 border-b">
          <PaginationPrevious 
            href={currentPage > 1 ? `/books?page=${currentPage - 1}` : null} 
          />
          
          <PaginationList>
            {visiblePages.map((pageNum, idx) => 
              pageNum === 'gap' ? (
                <PaginationGap key={`gap-${idx}`} />
              ) : (
                <PaginationPage
                  key={pageNum}
                  href={`/books?page=${pageNum}`}
                  current={pageNum === currentPage}
                >
                  {pageNum}
                </PaginationPage>
              )
            )}
          </PaginationList>

          <PaginationNext 
            href={currentPage < totalPages ? `/books?page=${currentPage + 1}` : null}
          />
        </Pagination>
      )}
    </main>
  )
}
