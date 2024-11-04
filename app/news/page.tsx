import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { PostItemSmall } from '@/components/PostItemSmall'
import { Database } from '@/types/supabase'

type BasePost = Database['public']['Tables']['content_post']['Row']
type Site = {
  title: string | null
  slug: string | null
}

interface PostWithSite extends BasePost {
  site: Site | null
}

const ITEMS_PER_PAGE = 25

export default async function NewsPage({ 
  searchParams 
}: { 
  searchParams: { page?: string }
}) {
  const currentPage = Number(searchParams.page) || 1
  const offset = (currentPage - 1) * ITEMS_PER_PAGE
  
  const supabase = await createClient()

  // Get total count for pagination
  const { count } = await supabase
    .from('content_post')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')

  // Get paginated posts
  const { data: posts, error: postsError } = await supabase
    .from('content_post')
    .select(`
      id,
      title,
      description,
      date_published,
      date_created,
      link,
      image_path,
      content,
      indexed,
      site_id,
      status,
      summary,
      tags_list,
      user_id,
      site:content_site!left (
        title,
        slug
      )
    `)
    .eq('status', 'published')
    .order('date_published', { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  if (postsError) {
    console.error('Error fetching posts:', postsError)
    return <div>Error loading posts</div>
  }

  console.log('Raw posts data:', posts?.[0])

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0

  // Transform the posts to match the PostItem component expectations
  const transformedPosts: PostWithSite[] = posts?.map(post => {
    // Log each post's site data during transformation
    console.log('Post site data:', post.site)
    
    return {
      ...post,
      site: Array.isArray(post.site) ? post.site[0] || null : post.site || null
    }
  }) || []

  // Log a transformed post to verify the structure
  console.log('Transformed post:', transformedPosts[0])


  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-5xl font-bold mb-2">UX news</h1>
      <p className='text-xl'>A feed of UX articles from the best sources on the web. Updated daily.</p>
      <div className="space-y-8 mt-12">
        {transformedPosts?.map((post) => (
          <PostItemSmall key={post.id} post={post} />
        ))}

        {!transformedPosts?.length && (
          <p className="text-gray-600">No posts found.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/news?page=${currentPage - 1}`}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/news?page=${currentPage + 1}`}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
