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

export function PostGridItem({ post }: { post: PostWithSite }) {
  return (
    <article className="flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {post.image_path && (
        <div className="relative aspect-[16/9]">
          <img 
            src={post.image_path} 
            alt=""
            className="object-cover w-full h-full"
          />
        </div>
      )}
      <div className="flex flex-col flex-grow p-6">
        <h2 className="text-lg font-semibold mb-2 line-clamp-2">
          <a 
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600"
          >
            {post.title}
          </a>
        </h2>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {truncateToWords(post.description, 15)}
        </p>
        <div className="mt-auto text-sm text-gray-500 flex items-center justify-between">
          <div>
            {post.site?.title && (
              <span>
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
            <time dateTime={post.date_published} className="text-xs">
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
