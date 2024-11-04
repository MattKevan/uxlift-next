import { PostFeatured } from '@/components/posts/PostsFeatured'

interface LayoutProps {
  posts: any[]
}

export const Layout1 = ({ posts }: LayoutProps) => {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PostFeatured post={posts[0]} />
    </div>
  )
}
