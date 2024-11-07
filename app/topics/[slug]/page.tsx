// /app/topics/[slug]/page.tsx

import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import type { Metadata } from 'next'
import { ToolCard } from '@/components/ToolCards'
import { Pager } from '@/components/Pager'
import { PostHorizontal } from '@/components/posts/PostsHorizontal'
import { FileText, Tool } from '@mynaui/icons-react'

type BasePost = Database['public']['Tables']['content_post']['Row']

type Site = {
  title: string | null
  slug: string | null
  site_icon: string | null
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

const ITEMS_PER_PAGE = 22

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


// Get total counts for both posts and tools
const { count: totalPostsCount } = await supabase
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

const { count: totalToolsCount } = await supabase
  .from('content_tool_topics')
  .select('*', { count: 'exact', head: true })
  .eq('topic_id', topic.id)

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

  const totalPages = totalPostsCount ? Math.ceil(totalPostsCount / ITEMS_PER_PAGE) : 0

  // Remove duplicate tools
  const uniqueTools = Array.from(new Map(tools?.map(tool => [tool.id, tool])).values())

  return (
    <main>
    <div className='px-6 mb-10 sm:mb-18  mt-6'>
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
        {topic.name}  
        {topic.description && (
          <span className=" mb-6 md:w-3/4 lg:w-4/5 tracking-tight ml-3 text-gray-500">
            {topic.description}
          </span>
        )}
      </h1>
  </div>
  
      
  <div className=' mb-10 sm:mb-18 border-b pt-12' id="articles" >
  <h2  className="text-lg font-bold pl-6 pt-4 bg-white/70 backdrop-blur-lg sticky top-[58px] pb-4 border-b z-40">{totalPostsCount} {topic.name} articles</h2>

        <div  className="grid grid-cols-1 md:grid-cols-2 border-b">
        {transformedPosts?.map((post) => (
            <div className='border-b border-r p-6 [&:nth-last-child(-n+2)]:border-b-0'>

            <PostHorizontal key={post.id} post={post} />
            </div>
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
        </div>

{uniqueTools.length > 0 && (
  <section className="mb-12 pt-12" id="tools">
  <h2  className="text-lg font-bold pl-6 pt-4 bg-white/70 backdrop-blur-lg sticky top-[58px] pb-4 border-b z-40">{totalToolsCount} {topic.name} tools</h2>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-b">
      {uniqueTools?.map((tool) => (
                                <div className='border-b border-r p-6 last:border-b-0'>

        <ToolCard key={tool.id} tool={tool} />
        </div>
      ))}
    </div>
  </section>
)}
<div className='bg-gray-100/70 backdrop-blur-lg dark:bg-gray-900/70 flex flex-row fixed bottom-[10px] shadow-lg p-1 rounded-full  left-1/2 transform -translate-x-1/2 '>

<a href="#articles" className='p-4 hover:bg-gray-200  rounded-full'><FileText className='size-6'/> </a>
<a href="#tools" className='p-4 hover:bg-gray-200  rounded-full'><Tool  className='size-6' /></a>
</div>
      </main>
  )
}
