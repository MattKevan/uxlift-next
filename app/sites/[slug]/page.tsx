import { cache, Suspense } from 'react'
import { createPublicClient } from '@/utils/supabase/public'
import { getAllSiteSlugs } from '@/lib/content/public-queries'
import PaginatedPostGrid from '@/components/posts/PaginatedPostGrid'
import { normalizePost } from '@/lib/content/post-shape'
import { notFound } from 'next/navigation'
import { PostItem } from '@/components/posts/PostItem'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { Button } from '@/components/ui/button'
import { ExternalLink } from '@mynaui/icons-react'
import type { Metadata } from 'next'

type Params = Promise<{ slug: string }>

interface PageProps {
  params: Params
}

export const revalidate = false
export const dynamicParams = true

export async function generateStaticParams() {
  return getAllSiteSlugs()
}

const getSiteData = cache(async (slug: string) => {
  const supabase = createPublicClient()

  const { data: site, error } = await supabase
    .from('content_site')
    .select('id, title, description, url, site_icon')
    .eq('slug', slug)
    .single()

  if (error || !site) {
    return null
  }

  return site
})

const ITEMS_PER_PAGE = 20

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  const { slug } = await params
  const site = await getSiteData(slug)

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

export default async function SitePage({ params }: PageProps) {
  const { slug } = await params
  const site = await getSiteData(slug)

  if (!site) {
    return notFound()
  }

  const supabase = createPublicClient()

  // Get total count for pagination
  const { count } = await supabase
    .from('content_post')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', site.id)
    .eq('status', 'published')

  // Get page 1; later pages are fetched client-side
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
    .range(0, ITEMS_PER_PAGE - 1)

  if (postsError) {
    console.error('Error fetching posts:', postsError)
    return <div>Error loading posts</div>
  }

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0

  const transformedPosts = (posts ?? []).map(normalizePost)

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
      {site.url && (
        <Button asChild>
          <a href={site.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            Go to site
          </a>
        </Button>
      )}
           <Button variant="outline" type="button">Follow</Button>
      </div>
      </div>
  
      <section className=' mb-10 sm:mb-18 border-b pt-12' id="articles" >
      <h2  className="text-lg font-bold pl-6 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">{count} articles</h2>

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
            source={{ kind: 'site', siteId: site.id }}
            initialPosts={transformedPosts}
            pageSize={ITEMS_PER_PAGE}
            totalPages={totalPages}
            basePath={`/sites/${slug}`}
            emptyMessage="No posts found for this site."
          />
        </Suspense>
        </section>

      
      </main>
  )
}
