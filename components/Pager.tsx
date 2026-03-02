import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface PagerProps {
  currentPage: number
  totalPages: number
  baseUrl: string
}

export function Pager({ currentPage, totalPages, baseUrl }: PagerProps) {
  // Don't show pagination if there's only one page
  if (totalPages <= 1) return null

  // Calculate the range of pages to show
  const createPageRange = () => {
    const range: number[] = []
    const maxPagesToShow = 5 // Show max 5 page numbers
    
    if (totalPages <= maxPagesToShow) {
      // If total pages is less than max, show all pages
      for (let i = 1; i <= totalPages; i++) {
        range.push(i)
      }
    } else {
      // Always show first page
      range.push(1)
      
      if (currentPage <= 3) {
        // If near start, show first 4 pages
        range.push(2, 3, 4)
      } else if (currentPage >= totalPages - 2) {
        // If near end, show last 4 pages
        range.push(totalPages - 3, totalPages - 2, totalPages - 1)
      } else {
        // Show current page and surrounding pages
        range.push(currentPage - 1, currentPage, currentPage + 1)
      }
      
      // Always show last page
      if (!range.includes(totalPages)) {
        range.push(totalPages)
      }
    }
    
    return range
  }

  const pageRange = createPageRange()
  const previousHref = currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null
  const nextHref = currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : null

  return (
    <Pagination className="p-6 font-sans border-b">
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
        {pageRange.map((pageNum, index) => {
          // If there's a gap in the sequence, add dots
          if (index > 0 && pageNum - pageRange[index - 1] > 1) {
            return (
              <PaginationItem key={`gap-${pageNum}`}>
                <PaginationEllipsis />
              </PaginationItem>
            )
          }
          
          return (
            <PaginationItem key={pageNum}>
              <PaginationLink
                href={`${baseUrl}?page=${pageNum}`}
                isActive={pageNum === currentPage}
              >
                {pageNum}
              </PaginationLink>
            </PaginationItem>
          )
        })}
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
  )
}
