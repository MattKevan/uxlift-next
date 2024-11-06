// /app/topics/[slug]/page.tsx

import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { Divider } from '@/components/catalyst/divider'
import { PostItemSmall } from '@/components/posts/PostItemSmall'
import type { Metadata } from 'next'
import { CldImage } from 'next-cloudinary';
import { ToolCard } from '@/components/ToolCards'
import { PostGridItem } from '@/components/posts/PostGridItem'
import { Pager } from '@/components/Pager'

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

const ITEMS_PER_PAGE = 21

async function getTopicData(slug: string) {
  const supabase = await createClient()
  
  // Get the topic details
  const { data: topic, error: topicError } = await supabase
    .from('content_topic')
    .select('id, name, description')
    .eq('slug', slug)
    .single()

  if (topicError || !topic) {
    return null
  }

  return topic
}

type MetadataProps = {
  params: Params
  searchParams: SearchParams
}

export async function generateMetadata(
  { params }: MetadataProps,
): Promise<Metadata> {
  const { slug } = await params
  
  // Reuse the same data fetching function
  const topic = await getTopicData(slug)

  return {
    title: topic?.name ? `${topic.name} | UX Lift` : 'Topics - UX Lift',
    description: topic?.description || 'Explore articles and resources on this topic',
    openGraph: {
      title: topic?.name ? `${topic.name} | UX Lift` : 'Topics | UX Lift',
      description: topic?.description || 'Explore articles and resources on this topic',
      url: `/topics/${slug}`,
      siteName: 'UX Lift',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: topic?.name ? `${topic.name} | UX Lift` : 'Topics | UX Lift',
      description: topic?.description || 'Explore articles and resources on this topic',
    },
  }
}

export default async function TopicPage({ 
  params,
  searchParams 
}: PageProps) {
  const { slug } = await params
  const { page } = await searchParams
  
  const currentPage = Number(page) || 1
  const offset = (currentPage - 1) * ITEMS_PER_PAGE
  
  // Reuse the same data fetching function
  const topic = await getTopicData(slug)

  if (!topic) {
    return notFound()
  }

  const supabase = await createClient()

  // Get tools for this topic
  const { data: tools, error: toolsError } = await supabase
    .from('content_tool')
    .select(`
      *,
      content_tool_topics!inner (topic_id)
    `)
    .eq('content_tool_topics.topic_id', topic.id)
    .eq('status', 'published')
    .order('date', { ascending: false })


// Get total count for pagination
const { count } = await supabase
  .from('content_post_topics')
  .select(`
    post:content_post!inner (
      id
    )
  `, { 
    count: 'exact', 
    head: true 
  })
  .eq('topic_id', topic.id)
  .eq('post.status', 'published')

// Then get paginated posts for this topic
const { data: posts, error: postsError } = await supabase
  .from('content_post_topics')
  .select(`
    post:content_post!inner (
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
        id,
        title,
        slug,
        url,
        site_icon
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
  .eq('topic_id', topic.id)
  .eq('post.status', 'published')
  .order('post(date_published)', { ascending: false })
  .range(offset, offset + ITEMS_PER_PAGE - 1)

// Update the post transformation to include topics
const transformedPosts: PostWithSite[] = posts
  ? posts.map((item: any) => ({
      ...item.post,
      site: item.post.site || null,
      topics: item.post.content_post_topics
        ?.map((topicRef: any) => topicRef.topic)
        .filter(Boolean) || []
    }))
  : []

  if (postsError || toolsError) {
    console.error('Error fetching content:', postsError || toolsError)
    return <div>Error loading content</div>
  }

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0

  // Remove duplicate tools
  const uniqueTools = Array.from(new Map(tools?.map(tool => [tool.id, tool])).values())

  return (
    <div className="py-8 max-w-6xl mx-auto">
      <h1 className="text-4xl lg:text-6xl font-bold mb-6">{topic.name}</h1>
      {topic.description && (
        <p className="text-gray-600 mb-12 text-xl lg:text-2xl">{topic.description}</p>
      )}
      <Divider className='my-12'/>
      <div className=''>
      <section>
        <h2 className="text-3xl font-bold mb-6">Articles</h2>
        <div className="space-y-8">
          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
          {transformedPosts?.map((post) => (
            <PostGridItem key={post.id} post={post} />
          ))}
          </div>
          {transformedPosts?.length === 0 && (
            <p className="text-gray-600">No posts found for this topic.</p>
          )}
        </div>
      </section>

      {totalPages > 1 && (
        <Pager 
          currentPage={currentPage}
          totalPages={totalPages}
          baseUrl={`/topics/${slug}`}
        />
      )}
        </div>

{uniqueTools.length > 0 && (
  <section className="mb-12 ">
    <Divider className='my-24' />
    <h2 className="text-3xl font-bold mb-6" id="tools">Tools</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {uniqueTools?.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  </section>
)}

      </div> 
  )
}
