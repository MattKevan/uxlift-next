import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { Database } from '@/types/supabase'
import { Metadata, ResolvingMetadata } from 'next'
import PageProps  from 'next/types'

import { PostHorizontal } from '@/components/posts/PostsHorizontalSmall'
import Link from 'next/link'
import { CustomImage } from '@/components/Image'
import { Button } from '@/components/catalyst/button'
import { Bookmark, ExternalLink, Like } from '@mynaui/icons-react'

// Types from PostHorizontalSmall to ensure compatibility
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
interface RelatedPostResponse {
  post: {
    id: number
    title: string
    description: string
    date_created: string
    date_published: string | null
    image_path: string | null
    indexed: boolean
    link: string
    site_id: number | null
    status: string
    summary: string
    content: string | null
    tags_list: string | null
    site: {
      title: string | null
      slug: string | null
      site_icon: string | null
    } | null
  }
}
interface PostWithSite extends BasePost {
  site: Site | null
  topics?: Topic[]
}


type Props = {
  params: {
    slug: string
  }
  searchParams: { [key: string]: string | string[] | undefined }
}


async function getPostData(slug: string) {
  const supabase = await createClient()
  
  const { data: post, error } = await supabase
    .from('content_post')
    .select(`
      *,
      site:content_site (
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
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !post) {
    return null
  }

  const transformedPost: PostWithSite = {
    ...post,
    site: {
      title: post.site?.title || null,
      slug: post.site?.slug || null,
      site_icon: post.site?.site_icon || null
    },
    topics: post.content_post_topics?.map((postTopic: PostTopic) => postTopic.topic) || []
  }

  return transformedPost
}


type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

interface PageProps {
  params: Params
  searchParams: SearchParams
}

type MetadataProps = {
  params: Params
  searchParams: SearchParams
}

export async function generateMetadata(
  { params }: MetadataProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostData(slug)

  if (!post) {
    return {
      title: 'Article Not Found | UX Lift'
    }
  }

  return {
    title: `${post.title} | UX Lift`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/articles/${slug}`,
      siteName: 'UX Lift',
      type: 'article',
      images: post.image_path ? [post.image_path] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  }
}

export default async function PostPage({ 
  params,
  searchParams 
}: PageProps) {
  const { slug } = await params
  const post = await getPostData(slug)
  
  if (!post) {
    return notFound()
  }

  const supabase = await createClient()

  // Get related posts from same site
  const { data: sameSitePosts } = await supabase
    .from('content_post')
    .select(`
      *,
      site:content_site (
        title,
        slug,
        site_icon
      )
    `)
    .eq('site_id', post.site_id)
    .neq('id', post.id)
    .eq('status', 'published')
    .order('date_published', { ascending: false })
    .limit(12)

  // Transform sameSitePosts to match PostWithSite interface
  const transformedSameSitePosts: PostWithSite[] = sameSitePosts?.map(sitePost => ({
    ...sitePost,
    site: {
      title: sitePost.site?.title || null,
      slug: sitePost.site?.slug || null,
      site_icon: sitePost.site?.site_icon || null
    }
  })) || []

  function transformPost(post: any): PostWithSite {
    return {
      id: post.id,
      title: post.title,
      description: post.description,
      date_created: post.date_created,
      date_published: post.date_published,
      image_path: post.image_path,
      indexed: post.indexed,
      link: post.link,
      site_id: post.site_id,
      status: post.status,
      summary: post.summary,
      content: post.content,
      tags_list: post.tags_list,
      user_id: post.user_id,
      slug: post.slug,
      site: {
        title: post.site?.title || null,
        slug: post.site?.slug || null,
        site_icon: post.site?.site_icon || null,
        id: post.site?.id,
        url: post.site?.url
      },
      // Add the required content_post_topics field
      content_post_topics: post.content_post_topics?.map((pt: any) => ({
        topic: {
          id: pt.topic.id,
          name: pt.topic.name,
          slug: pt.topic.slug
        }
      })) || []
    }
  }
  
  

  // Get related posts with same topics
  const topicIds = post.topics?.map(topic => topic.id) || []
  const { data: relatedPosts } = await supabase
  .from('content_post_topics')
  .select(`
    post:content_post (
      *,
      site:content_site (
        title,
        slug,
        site_icon,
        id,
        url
      ),
      content_post_topics!left (
        topic:content_topic (
          id,
          name,
          slug
        )
      )
    )
  `)
  .in('topic_id', topicIds)
  .neq('post.id', post.id)
  .eq('post.status', 'published')
  .order('post.date_published', { ascending: false })
  .limit(9)

  const transformedRelatedPosts: PostWithSite[] = relatedPosts?.map(
    ({ post: relatedPost }) => transformPost(relatedPost)
  ) || []
  

  return (
    <main>
      <div className='px-4 mb-24 sm:mb-32 mt-6'>
        <div className='max-w-6xl'>
          <div className="flex items-center justify-between mb-6">
            {post.site && (
              <div className="flex items-center gap-2">
                {post.site.site_icon && (
                  <CustomImage
                    src={post.site.site_icon}
                    alt={post.site.title || ''}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                    fallback="/images/default-site-icon.png"
                    priority
                  />
                )}
                {post.site.slug && (
                  <Link 
                    href={`/sites/${post.site.slug}`}
                    className="text-gray-600 hover:text-gray-900 font-semibold"
                  >
                    {post.site.title}
                  </Link>
                )}
              </div>
            )}
            {post.date_published && (
              <time dateTime={post.date_published} className='text-gray-400 text-sm'>
                {new Date(post.date_published).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Europe/London'
                })}
              </time>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            {post.title}
          </h1>

          {post.topics && post.topics.length > 0 && (
            <div className="flex gap-2 mb-6">
              {post.topics.map(topic => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="border px-3 py-1 rounded-full text-sm text-gray-600 hover:bg-gray-200"
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          )}

          {post.summary && (
            <div className="prose max-w-none mb-7">
              <p className="text-xl text-gray-600">{post.summary}</p>
            </div>
          )}

          <div className="mb-8 flex gap-2">
            <Button
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />Read the full article
            </Button>
            <Button color='white'><Like /> Like </Button>
            <Button color='white'><Bookmark />Bookmark</Button>
          </div>
        </div>
      </div>

      {transformedSameSitePosts.length > 0 && (
        <section className="mt-16">
          <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[58px] border-b z-30">
            More from {post.site?.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {transformedSameSitePosts.map((relatedPost) => (
              <PostHorizontal 
                key={relatedPost.id} 
                post={relatedPost} 
              />
            ))}
          </div>
        </section>
      )}

      {transformedRelatedPosts.length > 0 && (
        <section className="mt-16">
          <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[58px] border-b z-30">
            Related Articles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {transformedRelatedPosts.map((relatedPost) => (
              <PostHorizontal 
                key={relatedPost.id} 
                post={relatedPost} 
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
