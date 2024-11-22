import { createClient } from '@/utils/supabase/server'
import { PostHorizontal } from '@/components/posts/PostsHorizontalSmall'
import { ToolCard } from '@/components/ToolCards'

interface GroupedPosts {
  [key: string]: any[]
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
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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
    *,
    site:site_id (
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
      <h2 id="articles" className="text-lg font-bold pl-6 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[58px] pb-4 border-b z-40">Latest articles</h2>

        <div className='grid grid-cols-1 md:grid-cols-2'>
          {posts?.map((post) => (

              <PostHorizontal key={post.id} post={post} />
          ))}
        </div>

        <section className='mt-24'>
        <h2 id="tools" className="text-lg font-bold pl-4 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[58px] pb-4 border-b z-40">Latest tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {tools?.map((tool) => (

                    <ToolCard key={tool.id} tool={tool} />

          ))}
        </div>
      </section>
 
      
    </main>
  )
}
