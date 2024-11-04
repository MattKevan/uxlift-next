import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { PostItem } from '@/components/posts/PostItem'
import Link from 'next/link'
import { Database } from '@/types/supabase'

type BasePost = Database['public']['Tables']['content_post']['Row']
type Site = {
  title: string | null
  slug: string | null
}

interface PostWithSite extends BasePost {
  site: Site | null
}

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ page?: string }>

interface PageProps {
  params: Params
  searchParams: SearchParams 
}

const ITEMS_PER_PAGE = 20

export default async function SitePage({ 
  params,
  searchParams 
}: PageProps) {
  const { slug } = await params
  const { page } = await searchParams
  
  const currentPage = Number(page) || 1
  const offset = (currentPage - 1) * ITEMS_PER_PAGE
  
  const supabase = await createClient()
  
  // First get the site details
  const { data: site, error: siteError } = await supabase
    .from('content_site')
    .select('id, title, description, url, site_icon')
    .eq('slug', slug)
    .single()

  if (siteError || !site) {
    return notFound()
  }

  // Get total count for pagination
  const { count } = await supabase
    .from('content_post')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', site.id)
    .eq('status', 'published')

  // Get paginated posts for this site
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
      site:content_site (
        title,
        slug
      )
    `)
    .eq('site_id', site.id)
    .eq('status', 'published')
    .order('date_published', { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  if (postsError) {
    console.error('Error fetching posts:', postsError)
    return <div>Error loading posts</div>
  }

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0

  // Transform posts to match PostItem component expectations
  const transformedPosts: PostWithSite[] = (posts || []).map((post: any) => ({
    ...post,
    site: post.site?.[0] || null
  }))

  return (
    <div className="py-8 px-4 max-w-4xl mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          {site.site_icon && (
            <img 
              src={site.site_icon} 
              alt="" 
              className="w-16 h-16 rounded-lg"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold mb-2">{site.title}</h1>
            {site.url && (
              <a 
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                {new URL(site.url).hostname}
              </a>
            )}
          </div>
        </div>
        {site.description && (
          <p className="text-gray-600">{site.description}</p>
        )}
      </header>

      <section>
        <h2 className="text-2xl font-bold mb-6">Latest Posts</h2>
        <div className="space-y-8">
          {transformedPosts?.map((post) => (
            <PostItem key={post.id} post={post} />
          ))}

          {transformedPosts?.length === 0 && (
            <p className="text-gray-600">No posts found from this site.</p>
          )}
        </div>
      </section>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/sites/${slug}?page=${currentPage - 1}`}
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
              href={`/sites/${slug}?page=${currentPage + 1}`}
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
