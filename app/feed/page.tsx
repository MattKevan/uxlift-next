import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { PostHorizontal } from '@/components/posts/PostsHorizontalSmall'
import { Pager } from '@/components/Pager'
import type { Database } from '@/types/supabase'
import Link from 'next/link'
import { Lightning } from '@mynaui/icons-react'
import { Button } from '@/components/ui/button'

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


// Add types for the topics
type UserTopicWithDetails = {
  topic_id: number
  topic: Topic
}

const ITEMS_PER_PAGE = 20


interface PageProps {
  params: Params
  searchParams: SearchParams
}

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ page?: string }>

export default async function ProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { page } = await searchParams
  await params


  const currentPage = Number(page) || 1
  const offset = (currentPage - 1) * ITEMS_PER_PAGE

  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    redirect('/profile/create')
  }

  // Get user's topics with topic names
  const { data: userTopics } = await supabase
    .from('content_user_topics')
    .select(`
      topic_id,
      topic:content_topic (
        id,
        name,
        slug
      )
    `)
    .eq('user_profile_id', profile.id) as { data: UserTopicWithDetails[] | null }

  const topicIds = userTopics?.map(t => t.topic_id) || []

  if (topicIds.length === 0) {
    return (
      <main>
        <div className='px-6 mb-24 sm:mb-32 mt-6'>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
            Newsfeed
          </h1>
        </div>
        <div className="col-span-full p-6 text-center">
          <p className="text-gray-500 mb-4">No topics selected yet.</p>
          <p className="text-sm">
            Select some topics in your{' '}
            <a href="/profile/edit" className="text-primary hover:underline">
              profile settings
            </a>
            {' '}to get started
          </p>
        </div>
      </main>
    )
  }

  // Get total count for pagination
  const { count } = await supabase
    .from('content_post_topics')
    .select('*', { count: 'exact', head: true })
    .in('topic_id', topicIds)

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0

  // Get paginated posts
  const { data: posts } = await supabase
    .from('content_post_topics')
    .select(`
      post:content_post!inner (
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
        )
      )
    `)
    .eq('post.status', 'published')
    .in('topic_id', topicIds)
    .order('post(date_published)', { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  // Transform posts to match PostHorizontal component expectations
  const transformedPosts: PostWithSite[] = (posts || []).map((item: any) => ({
    ...item.post,
    site: item.post.site || null
  }))

  return (
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
        <div className='flex justify-between'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight flex gap-2">
          <Lightning className='size-10 md:size-12'/> Newsfeed 
          
        </h1>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          {userTopics?.map((topic) => (
            <Link
              key={topic.topic_id}
              href={`/topics/${topic.topic.slug}`}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full"
            >
              {topic.topic.name}
            </Link>
          ))}
          
        </div>
        <Button variant="outline" asChild>
          <Link
            href="/profile/edit"
            className="text-sm bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 rounded-full"
          >
            Customise feed
            </Link>
          </Button>
      </div>
      <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
            Articles
          </h2>
      <section className="grid grid-cols-1 md:grid-cols-2">

        {transformedPosts.length > 0 ? (
          transformedPosts.map((post) => (
            <PostHorizontal key={post.id} post={post} />
          ))
        ) : (
          <div className="col-span-full p-6 text-center">
            <p className="text-gray-500 mb-4">No posts found for your selected topics.</p>
            <p className="text-sm">
              Try selecting more topics in your{' '}
              <a href="/profile/edit" className="text-primary hover:underline">
                profile settings
              </a>
            </p>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <Pager 
          currentPage={currentPage}
          totalPages={totalPages}
          baseUrl="/feed"
        />
      )}
    </main>
  )
}
