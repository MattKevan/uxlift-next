import { createClient } from '@/utils/supabase/server'
import { PostGridItem } from '@/components/posts/PostGridItem'
import Link from 'next/link'
import { Layout1 } from '@/components/Layout1'
import { Layout2 } from '@/components/Layout2'
import { Layout3 } from '@/components/Layout3'
import { Layout4 } from '@/components/Layout4'

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
    <main className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-12 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Latest Articles</h1>
        <Link 
          href="/news" 
          className="text-blue-600 hover:text-blue-800"
        >
          View all articles →
        </Link>
      </div>

      <div className="space-y-16">
        {lastSevenDays.map(dateKey => {
          const postsForDay = groupedPosts[dateKey] || []
          
          if (postsForDay.length === 0) return null
          
          return (
            <section key={dateKey} className="space-y-6">
              <h2 className="text-2xl font-semibold">
                {formatDate(dateKey)}
              </h2>
              <PostLayout posts={postsForDay} />
            </section>
          )
        })}
      </div>

      {Object.keys(groupedPosts).length === 0 && (
        <p className="text-gray-600 text-center py-12">No posts found from the last 7 days.</p>
      )}
    </main>
  )
}
