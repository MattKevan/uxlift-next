import { createClient } from '@/utils/supabase/server'
import { PostHorizontal } from '@/components/posts/PostsHorizontalSmall'
import { ToolCard } from '@/components/ToolCards'
import type { Database } from '@/types/supabase'
import { format } from 'date-fns'

interface GroupedPosts {
  [key: string]: any[]
}

// Type for our optimized homepage query
type HomePagePost = {
  id: number
  title: string
  description: string
  link: string
  date_published: string | null
  image_path: string | null
  slug: string | null
  site_id: number | null
  content_site: {
    id: number
    title: string
    slug: string
    url: string
    site_icon: string | null
  }[] | null
}

// Extended type that matches PostWithSite interface  
type PostWithSiteCompat = {
  id: number
  title: string
  description: string
  link: string
  date_published: string | null
  image_path: string | null
  slug: string | null
  site: {
    title: string | null
    slug: string | null
    site_icon: string | null
  } | null
  content_post_topics: any[]
  content: string | null
  date_created: string
  indexed: boolean
  status: string
  summary: string
  tags_list: string | null
  user_id: number | null
  site_id: number | null
}

function groupPostsByDate(posts: any[]): GroupedPosts {
  return posts.reduce((groups: GroupedPosts, post) => {
    if (!post.date_published) return groups
    
    const date = new Date(post.date_published)
    const dateKey = date.toISOString().split('T')[0]
    
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    
    groups[dateKey].push(post)
    return groups
  }, {})
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return format(date, 'EEEE, dd MMMM yyyy')
}

function getLastSevenDays(): string[] {
  const dates: string[] = []
  const today = new Date()
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    dates.push(date.toISOString().split('T')[0])
  }
  
  return dates
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data: posts, error: postsError } = await supabase
  .from('content_post')
  .select(`
    id,
    title,
    description,
    link,
    date_published,
    image_path,
    slug,
    site_id,
    content_site!left (
      id,
      title,
      slug,
      url,
      site_icon
    )
  `, { count: 'exact' })
  .eq('status', 'published')
  .order('date_published', { ascending: false })
  .limit(12)


  const { data: tools, error: toolsError } = await supabase
    .from('content_tool')
    .select()
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(9)

  if (toolsError) {
    console.error('Error fetching tools:', toolsError)
    return <div>Error loading tools</div>
  }


  return (
    <main className="">
      <div className='px-4 sm:px-6 mb-32 mt-6'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">UX Lift <span className="text-gray-500">is the place to discover and share UX articles, news and resources.</span></h1>
      </div>
      <h2 id="articles" className="text-lg font-bold pl-6 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">Latest articles</h2>

        <div className='grid grid-cols-1 md:grid-cols-2'>
          {posts?.map((post) => {
            // Transform the optimized post data to match component expectations
            const site = post.content_site?.[0] || null
            const compatPost: PostWithSiteCompat = {
              id: post.id,
              title: post.title,
              description: post.description,
              link: post.link,
              date_published: post.date_published,
              image_path: post.image_path,
              slug: post.slug,
              site: site ? {
                title: site.title,
                slug: site.slug,
                site_icon: site.site_icon
              } : null,
              content_post_topics: [],
              content: null,
              date_created: post.date_published || new Date().toISOString(),
              indexed: false,
              status: 'published',
              summary: '',
              tags_list: null,
              user_id: null,
              site_id: post.site_id
            }
            return <PostHorizontal key={post.id} post={compatPost} />
          })}
        </div>

        <section className='mt-24'>
        <h2 id="tools" className="text-lg font-bold pl-4 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">Latest tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {tools?.map((tool) => (

                    <ToolCard key={tool.id} tool={tool} />

          ))}
        </div>
      </section>
 
      
    </main>
  )
}
