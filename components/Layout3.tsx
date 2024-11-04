import { PostFeatured } from '@/components/posts/PostsFeatured'
import { PostCompact } from '@/components/posts/PostCompact'

interface LayoutProps {
  posts: any[]
}

export const Layout3 = ({ posts }: LayoutProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <PostFeatured post={posts[0]} />
      </div>
      <div className="space-y-6">
        {posts.slice(1).map(post => (
          <PostCompact key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
