import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { Database } from '@/types/supabase'

type NewsletterPost = Database['public']['Tables']['newsletter_posts']['Row']

export function NewsletterPost({ post }: { post: NewsletterPost }) {
  return (
    <article className="p-6 border-b border-r hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
      <div className="space-y-4">
        {post.thumbnail_url && (
          <Link href={`/newsletter/${post.slug}`}>
            <div className="aspect-[1.91/1] overflow-hidden rounded-lg">
              <img
                src={post.thumbnail_url}
                alt={post.title}
                className="object-cover w-full h-full"
              />
            </div>
          </Link>
        )}
        
        <div className="space-y-2">
        <Link href={`/newsletter/${post.slug}`} className="group">
        <h2 className="text-xl font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {post.title}
            </h2>
          </Link>

          {post.subtitle && (
            <p className="text-gray-600 dark:text-gray-400">
              {post.subtitle}
            </p>
          )}

        </div>

        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
          <time dateTime={post.publish_date}>
            {format(parseISO(post.publish_date), 'MMMM d, yyyy')}
          </time>
         
        </div>
      </div>
    </article>
  )
}
