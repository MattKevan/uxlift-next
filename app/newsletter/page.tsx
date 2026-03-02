import { createClient } from '@/utils/supabase/server'
import { NewsletterPost } from '@/components/NewsletterPost'
import {
  Pagination,
  PaginationContent,
  PaginationPrevious,
  PaginationNext,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from '@/components/ui/pagination'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ page?: string }>

interface PageProps {
  params: Params
  searchParams: SearchParams
}

export default async function NewsletterPage({
  params,
  searchParams,
}: PageProps) {
  const { page } = await searchParams
  await params

  const currentPage = Number(page) || 1
  const pageSize = 24
  const startIndex = (currentPage - 1) * pageSize

  const supabase = await createClient()

  const { data: posts, count } = await supabase
    .from('newsletter_posts')
    .select('*', { count: 'exact' })
    .eq('status', 'confirmed')
    .order('publish_date', { ascending: false })
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
  const previousHref = currentPage > 1 ? `/newsletter?page=${currentPage - 1}` : null
  const nextHref = currentPage < totalPages ? `/newsletter?page=${currentPage + 1}` : null

  return (
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          Newsletter <br/><span className="text-gray-500">A roundup of the best UX news, articles, tools and other fun stuff, every two weeks.</span>
        </h1>
      </div>

      <h2 className="text-lg font-bold pl-6 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">
        {count} editions
      </h2>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  -mb-[2px]'>
        {posts?.map((post) => (
          <NewsletterPost key={post.id} post={post} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination className="p-4 border-b">
          <PaginationContent>
            <PaginationItem>
              {previousHref ? (
                <PaginationPrevious href={previousHref} />
              ) : (
                <span className="pointer-events-none opacity-50">
                  <PaginationPrevious href="#" tabIndex={-1} />
                </span>
              )}
            </PaginationItem>
            {visiblePages.map((pageNum, idx) =>
              pageNum === 'gap' ? (
                <PaginationItem key={`gap-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    href={`/newsletter?page=${pageNum}`}
                    isActive={pageNum === currentPage}
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              {nextHref ? (
                <PaginationNext href={nextHref} />
              ) : (
                <span className="pointer-events-none opacity-50">
                  <PaginationNext href="#" tabIndex={-1} />
                </span>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </main>
  )
}
