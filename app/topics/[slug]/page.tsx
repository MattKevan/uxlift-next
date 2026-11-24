// /app/topics/[slug]/page.tsx
import { cache, Suspense } from 'react'
import { createPublicClient } from '@/utils/supabase/public'
import { getAllTopicSlugs } from '@/lib/content/public-queries'
import PaginatedPostGrid from '@/components/posts/PaginatedPostGrid'
import { normalizePost } from '@/lib/content/post-shape'
import { notFound } from 'next/navigation'
import { Database } from '@/types/supabase'
import type { Metadata } from 'next'
import { ToolCard } from '@/components/ToolCards'
import { Book, FileText, Tool } from '@mynaui/icons-react'
import { BookCard } from '@/components/BookCards'
import { BookWithTopics } from '@/components/BookCards'  // Import the interface
import { ResourceCard } from '@/components/ResourceCard'
import { Layers } from 'lucide-react'

type Params = Promise<{ slug: string }>

interface PageProps {
  params: Params
}

export const revalidate = false
export const dynamicParams = true

export async function generateStaticParams() {
  return getAllTopicSlugs()
}

const ITEMS_PER_PAGE = 22

const getTopicData = cache(async (slug: string) => {
  const supabase = createPublicClient()

  const { data: topic, error: topicError } = await supabase
    .from('content_topic')
    .select('id, name, description')
    .eq('slug', slug)
    .single()

  if (topicError || !topic) {
    return null
  }

  return topic
})

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  const { slug } = await params
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

export default async function TopicPage({ params }: PageProps) {
  const { slug } = await params
  
  const topic = await getTopicData(slug)

  if (!topic) {
    return notFound()
  }

  const supabase = createPublicClient()

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

  // Get resources for this topic
  const { data: resources, error: resourcesError } = await supabase
    .from('content_resource')
    .select(`
      *,
      resource_category:content_resource_category (
        id,
        name,
        slug
      ),
      content_resource_topics!inner (topic_id)
    `)
    .eq('content_resource_topics.topic_id', topic.id)
    .eq('status', 'published')
    .order('date_published', { ascending: false, nullsFirst: false })

  // Get total counts
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

  const { count: totalResourcesCount } = await supabase
    .from('content_resource_topics')
    .select(`
      resource:content_resource!inner (
        id
      )
    `, {
      count: 'exact',
      head: true
    })
    .eq('topic_id', topic.id)
    .eq('resource.status', 'published')

  // Get books for this topic
  const { data: booksData, count: totalBooksCount } = await supabase
    .from('content_book')
    .select(`
      *,
      topics:content_book_topics!inner(
        topic:topic_id(*)
      )
    `, { count: 'exact' })
    .eq('content_book_topics.topic_id', topic.id)
    .eq('status', 'published')
    .order('title', { ascending: true })

  // Transform books data
  const books: BookWithTopics[] = booksData?.map(book => ({
    id: book.id,
    title: book.title,
    slug: book.slug,
    description: book.description,
    authors: book.authors,
    publisher: book.publisher,
    link: book.link,
    image_path: book.image_path,
    date_created: book.date_created,
    date_published: book.date_published,
    free: book.free,
    status: book.status,
    summary: book.summary,
    body: book.body,
    topics: book.topics
  })) || []

  // Get paginated posts
  const { data: posts, error: postsError } = await supabase
    .from('content_post_topics')
    .select(`
      post:content_post!inner (
        id,
        slug,
        title,
        description,
        date_published,
        link,
        image_path,
        site:content_site!left (
          id,
          title,
          slug,
          site_icon
        )
      )
    `)
    .eq('topic_id', topic.id)
    .eq('post.status', 'published')
    .order('post(date_published)', { ascending: false })
    .range(0, ITEMS_PER_PAGE - 1)

  const transformedPosts = (posts ?? []).map((item: any) =>
    normalizePost(item.post),
  )

  if (postsError || toolsError || resourcesError) {
    console.error('Error fetching content:', postsError || toolsError || resourcesError)
    return <div>Error loading content</div>
  }

  const totalPages = totalPostsCount ? Math.ceil(totalPostsCount / ITEMS_PER_PAGE) : 0
  const uniqueTools = Array.from(new Map(tools?.map(tool => [tool.id, tool])).values())
  const uniqueResources = Array.from(new Map(resources?.map(resource => [resource.id, resource])).values())

  return (
    <main>
      <div className='px-4 mb-10 sm:mb-18 mt-6'>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          {topic.name}  
          {topic.description && (
            <span className="mb-6 md:w-3/4 lg:w-4/5 tracking-tight ml-3 text-gray-500">
              {topic.description}
            </span>
          )}
        </h1>
      </div>
      
      <section className='mb-10 sm:mb-18 pt-12' id="articles">
        <h2 className="font-bold px-4 py-3 md:py-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-40">
          {totalPostsCount} {topic.name} articles
        </h2>

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
            source={{ kind: 'topic', topicId: topic.id }}
            initialPosts={transformedPosts}
            pageSize={ITEMS_PER_PAGE}
            totalPages={totalPages}
            basePath={`/topics/${slug}`}
            emptyMessage="No posts found for this topic."
          />
        </Suspense>
      </section>

      {uniqueTools.length > 0 && (
        <section className="mb-12 pt-12" id="tools">
          <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
            {totalToolsCount} {topic.name} tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {uniqueTools?.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      )}

      {uniqueResources.length > 0 && (
        <section className="mb-12 pt-12" id="resources">
          <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
            {totalResourcesCount} {topic.name} resources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {uniqueResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </section>
      )}

      {books && books.length > 0 && (
        <section className="mb-12 pt-12" id="books">
          <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
            {totalBooksCount} {topic.name} books
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 border-b -mb-[2px]">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}

      

      <div className='bg-gray-100/70 backdrop-blur-lg dark:bg-gray-900/70 flex flex-row fixed bottom-[10px] shadow-lg  rounded-full left-1/2 transform -translate-x-1/2 z-50'>
        <a href="#articles" className='p-4 hover:bg-gray-200 rounded-full'>
          <FileText className='size-6'/>
        </a>
      
        {uniqueTools.length > 0 && (
          <a href="#tools" className='p-4 hover:bg-gray-200 rounded-full'>
            <Tool className='size-6'/>
          </a>
        )}
        {uniqueResources.length > 0 && (
          <a href="#resources" className='p-4 hover:bg-gray-200 rounded-full'>
            <Layers className='size-6'/>
          </a>
        )}
          {books && books.length > 0 && (
          <a href="#books" className='p-4 hover:bg-gray-200 rounded-full'>
            <Book className='size-6'/>
          </a>
        )}
      </div>
    </main>
  )
}
