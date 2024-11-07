import { createClient } from '@/utils/supabase/server'
import { PostGridItem } from '@/components/posts/PostGridItem'
import Link from 'next/link'
import { Layout1 } from '@/components/Layout1'
import { Layout2 } from '@/components/Layout2'
import { Layout3 } from '@/components/Layout3'
import { Layout4 } from '@/components/Layout4'
import { Divider } from '@/components/catalyst/divider'
import { PostHorizontal } from '@/components/posts/PostsHorizontal'

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

  // Get the date 7 days ago
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: posts, error: postsError } = await supabase
    .from('content_post')
    .select(`
      *,
      site:content_site (
        title,
        slug
      )
    `)
    .eq('status', 'published')
    .gte('date_published', sevenDaysAgo.toISOString())
    .order('date_published', { ascending: false })

  if (postsError) {
    console.error('Error fetching posts:', postsError)
    return <div>Error loading posts</div>
  }

  const transformedPosts = posts?.map(post => ({
    ...post,
    site: post.site?.[0] || null
  })) || []

  const groupedPosts = groupPostsByDate(transformedPosts)
  const lastSevenDays = getLastSevenDays()

  const PostLayout = ({ posts }: { posts: any[] }) => {
    switch (posts.length) {
      case 1:
        return <Layout1 posts={posts} />;
      case 2:
        return <Layout2 posts={posts} />;
      case 3:
        return <Layout3 posts={posts} />;
      default: // 4 or more posts
        return <Layout4 posts={posts.slice(0, 4)} />;
    }
  };

  return (
    <main className="">
      <div className='px-6 mb-32 mt-6'>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">UX Lift <span className="text-gray-500">is the place to discover and share UX articles, news and resources.</span></h1>
      </div>

      <div className='border-t grid grid-cols-3'>
        <div className='col-span-2'>
          {posts?.map((post) => (
            <div className='border-b p-6'>

              <PostHorizontal key={post.id} post={post} />
            </div>
          ))}
        </div>
        <div className='border-l'>
        </div>

  </div>
    
 
      
    </main>
  )
}
