import { createClient } from '@/utils/supabase/server'
import { PostItemSmall } from '@/components/posts/PostItemSmall'
import { Database } from '@/types/supabase'
import {
  Pagination,
  PaginationPrevious,
  PaginationNext,
  PaginationList,
  PaginationPage,
  PaginationGap,
} from '@/components/catalyst/pagination'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ page?: string }>

interface PageProps {
  params: Params
  searchParams: SearchParams
}

export default async function NewsPage({
  params,
  searchParams,
}: PageProps) {
  const { page } = await searchParams
  await params // We need to await params even if we don't use it

  const currentPage = Number(page) || 1
  const pageSize = 20
  const startIndex = (currentPage - 1) * pageSize

  const supabase = await createClient()

  const { data: posts, count } = await supabase
    .from('content_post')
    .select(`
      *,
      site:site_id (
        title,
        slug
      )
    `, { count: 'exact' })
    .eq('status', 'published')
    .order('date_published', { ascending: false })
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Latest News</h1>

      <div className="space-y-8">
        {posts?.map((post) => (
          <PostItemSmall key={post.id} post={post} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-8">
          <PaginationPrevious 
            href={currentPage > 1 ? `/news?page=${currentPage - 1}` : null} 
          />
          
          <PaginationList>
            {visiblePages.map((pageNum, idx) => 
              pageNum === 'gap' ? (
                <PaginationGap key={`gap-${idx}`} />
              ) : (
                <PaginationPage
                  key={pageNum}
                  href={`/news?page=${pageNum}`}
                  current={pageNum === currentPage}
                >
                  {pageNum}
                </PaginationPage>
              )
            )}
          </PaginationList>

          <PaginationNext 
            href={currentPage < totalPages ? `/news?page=${currentPage + 1}` : null}
          />
        </Pagination>
      )}
    </div>
  )
}
