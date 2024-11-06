import { PostFeatured } from '@/components/posts/PostsFeatured'
import { PostGridItem } from '@/components/posts/PostGridItem'

interface LayoutProps {
  posts: any[]
}

export const Layout4 = ({ posts }: LayoutProps) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <PostFeatured post={posts[0]} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.slice(1).map(post => (
          <PostGridItem key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
