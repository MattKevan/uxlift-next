import Link from 'next/link'
import { Database } from '@/types/supabase'

type BasePost = Database['public']['Tables']['content_post']['Row']
type Site = {
  title: string | null
  slug: string | null
}

interface PostWithSite extends BasePost {
  site: Site | null
}

function truncateToWords(str: string, numWords: number) {
  const words = str.trim().split(/\s+/)
  if (words.length <= numWords) return str
  return words.slice(0, numWords).join(' ') + '...'
}

export function PostFeatured({ post }: { post: PostWithSite }) {
  return (
    <article className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {post.image_path && (
        <div className="relative aspect-[16/9]">
          <img 
            src={post.image_path} 
            alt=""
            className="object-cover w-full h-full"
          />
        </div>
      )}
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">
          <a 
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600"
          >
            {post.title}
          </a>
        </h2>
        <p className="text-gray-600 mb-6 text-lg">
          {truncateToWords(post.description, 30)}
        </p>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div>
            {post.site?.title && (
              <span className="font-medium">
                {post.site.slug ? (
                  <Link 
                    href={`/sites/${post.site.slug}`}
                    className="hover:text-blue-600"
                  >
                    {post.site.title}
                  </Link>
                ) : (
                  post.site.title
                )}
              </span>
            )}
          </div>
          {post.date_published && (
            <time dateTime={post.date_published}>
              {new Date(post.date_published).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Europe/London'
              })}
            </time>
          )}
        </div>
      </div>
    </article>
  )
}
