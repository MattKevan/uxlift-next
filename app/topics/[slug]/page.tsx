// /app/topics/[slug]/page.tsx
import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { Database } from '@/types/supabase'
import type { Metadata } from 'next'
import { ToolCard } from '@/components/ToolCards'
import { Pager } from '@/components/Pager'
import { PostHorizontal } from '@/components/posts/PostsHorizontalSmall'
import { Book, FileText, Tool } from '@mynaui/icons-react'
import { BookCard } from '@/components/BookCards'
import { BookWithTopics } from '@/components/BookCards'  // Import the interface

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

const ITEMS_PER_PAGE = 22

async function getTopicData(slug: string) {
  const supabase = await createClient()

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
    .range(offset, offset + ITEMS_PER_PAGE - 1)

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
  const uniqueTools = Array.from(new Map(tools?.map(tool => [tool.id, tool])).values())

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

        <div className="grid grid-cols-1 md:grid-cols-2">
          {transformedPosts?.map((post) => (
            <PostHorizontal key={post.id} post={post} />
          ))}
        </div>
         
        {transformedPosts?.length === 0 && (
          <p className="text-gray-600 p-4">No posts found for this topic.</p>
        )}

        {totalPages > 1 && (
          <Pager 
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl={`/topics/${slug}`}
          />
        )}
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
          {books && books.length > 0 && (
          <a href="#books" className='p-4 hover:bg-gray-200 rounded-full'>
            <Book className='size-6'/>
          </a>
        )}
      </div>
    </main>
  )
}
