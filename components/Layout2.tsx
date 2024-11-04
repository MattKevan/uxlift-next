import { PostHorizontal } from '@/components/posts/PostsHorizontal'

interface LayoutProps {
  posts: any[]
}

export const Layout2 = ({ posts }: LayoutProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {posts.map(post => (
        <PostHorizontal key={post.id} post={post} />
      ))}
    </div>
  )
}
