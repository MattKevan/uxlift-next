import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { Divider } from '@/components/catalyst/divider'
import { PostItem } from '@/components/PostItem'

type BasePost = Database['public']['Tables']['content_post']['Row']
type Site = {
  title: string | null
  slug: string | null
}

interface PostWithSite extends BasePost {
  site: Site | null
}


const ITEMS_PER_PAGE = 20

export default async function TopicPage({ 
  params,
  searchParams 
}: { 
  params: { slug: string }
  searchParams: { page?: string }
}) {
  const currentPage = Number(searchParams.page) || 1
  const offset = (currentPage - 1) * ITEMS_PER_PAGE
  
  const supabase = await createClient()
  
  // First get the topic details
  const { data: topic, error: topicError } = await supabase
    .from('content_topic')
    .select('id, name, description')
    .eq('slug', params.slug)
    .single()

  if (topicError || !topic) {
    return notFound()
  }

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
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topic.id)

  // Then get paginated posts for this topic
  const { data: posts, error: postsError } = await supabase
    .from('content_post_topics')
    .select(`
      post:content_post (
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
        site:content_site (
          title,
          slug
        )
      )
    `)
    .eq('topic_id', topic.id)
    .order('date_published', { foreignTable: 'content_post', ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  if (postsError || toolsError) {
    console.error('Error fetching content:', postsError || toolsError)
    return <div>Error loading content</div>
  }

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0

  // Type assertion with unknown as intermediate step
  const transformedPosts: PostWithSite[] = posts
    ? posts
        .map((item: any) => item.post)
        .flat()
        .map((post: any) => ({
          ...post,
          site: post.site?.[0] || null
        }))
        .sort((a, b) => {
          const dateA = a.date_published ? new Date(a.date_published) : new Date(0)
          const dateB = b.date_published ? new Date(b.date_published) : new Date(0)
          return dateB.getTime() - dateA.getTime()
        })
    : []

  // Remove duplicate tools
  const uniqueTools = Array.from(new Map(tools?.map(tool => [tool.id, tool])).values())

  return (
    <div className="py-8 px-4">
      <h1 className="text-3xl font-bold mb-2">{topic.name}</h1>
      {topic.description && (
        <p className="text-gray-600 mb-8">{topic.description}</p>
      )}
      


      <section>
        <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
        <div className="space-y-8">
          {transformedPosts?.map((post) => (
            <PostItem key={post.id} post={post} />
          ))}

          {transformedPosts?.length === 0 && (
            <p className="text-gray-600">No posts found for this topic.</p>
          )}
        </div>
      </section>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/topics/${params.slug}?page=${currentPage - 1}`}
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
              href={`/topics/${params.slug}?page=${currentPage + 1}`}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}

{uniqueTools.length > 0 && (
        <section className="mb-12">
                <Divider className='my-24' />

          <h2 className="text-2xl font-bold mb-6">Related Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uniqueTools.map((tool) => (
              <a
                key={tool.id}
                href={tool.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className="aspect-video mb-3 overflow-hidden rounded-lg">
                  <img
                    src={tool.image}
                    alt={tool.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="font-semibold mb-2 group-hover:text-blue-600">
                  {tool.title}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {tool.description}
                </p>
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(tool.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}    
    </div>
  )
}
