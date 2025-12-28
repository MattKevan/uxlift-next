import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { PostItem } from '@/components/posts/PostItem'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { PostHorizontal } from '@/components/posts/PostsHorizontalSmall'
import { Pager } from '@/components/Pager'
import { Button } from '@/components/catalyst/button'
import { ExternalLink } from '@mynaui/icons-react'
import type { Metadata } from 'next'

type BasePost = Database['public']['Tables']['content_post']['Row']
type Site = {
  id: number
  title: string | null
  slug: string | null
  url: string | null
  site_icon: string | null
}

type Topic = {
  id: number
  name: string
  slug: string
}

type PostTopic = {
  topic: Topic
}

interface PostWithSite extends BasePost {
  site: Site | null
  content_post_topics: PostTopic[]
}

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ page?: string }>

interface PageProps {
  params: Params
  searchParams: SearchParams 
}

const ITEMS_PER_PAGE = 20

type MetadataProps = {
  params: Params
  searchParams: SearchParams
}

export async function generateMetadata(
  { params }: MetadataProps,
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('content_site')
    .select('id, title, description, url')
    .eq('slug', slug)
    .single()

  if (!site) {
    return {
      title: 'Site Not Found | UX Lift'
    }
  }

  return {
    title: `${site.title} Articles | UX Lift`,
    description: site.description || `Explore articles and resources from ${site.title}`,
    openGraph: {
      title: `${site.title} | UX Lift`,
      description: site.description || `Explore articles and resources from ${site.title}`,
      url: `/sites/${slug}`,
      siteName: 'UX Lift',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${site.title} | UX Lift`,
      description: site.description || `Explore articles and resources from ${site.title}`,
    },
  }
}

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
      link,
      image_path,
      slug,
      site:content_site!left (
        title,
        slug,
        site_icon
      ),
      content_post_topics!left (
        topic:content_topic (
          id,
          name,
          slug
        )
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
    site: post.site || null  // Remove the ?.[0] as site is now a single object
  }))

  return (
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
      <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
      {site.title}
      {site.description && (

        <span className="text-gray-500 ml-2">
          {site.description}
          </span>

      )}
      </h1>
      <div className='flex gap-2'>
      <Button >
        <ExternalLink/>
            <a href={site.url} target="_blank" rel="noopener noreferrer" >
              Go to site
            </a>
          </Button> 
           <Button outline>Follow</Button>
      </div>
      </div>
  
      <section className=' mb-10 sm:mb-18 border-b pt-12' id="articles" >
      <h2  className="text-lg font-bold pl-6 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">{count} articles</h2>

        <div  className="grid grid-cols-1 md:grid-cols-2 border-b">
        {transformedPosts?.map((post) => (

            <PostHorizontal key={post.id} post={post} />
          ))}
        </div>
         
          {transformedPosts?.length === 0 && (
            <p className="text-gray-600">No posts found for this topic.</p>
          )}

      {totalPages > 1 && (
        <Pager 
          currentPage={currentPage}
          totalPages={totalPages}
          baseUrl={`/topics/${slug}`}
        />
      )}
        </section>

      
      </main>
  )
}
