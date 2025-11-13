import Link from 'next/link'
import { Database } from '@/types/supabase'
import { format } from 'date-fns'

type BasePost = Database['public']['Tables']['content_post']['Row']
type Site = {
  title: string | null
  slug: string | null
}

interface PostWithSite extends BasePost {
  site: Site | null
}

export function PostCompact({ post }: { post: PostWithSite }) {
  return (
    <article className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center p-4">
        {post.image_path && post.image_path.trim() !== '' && (
          <div className="relative w-16 h-16 flex-shrink-0 mr-4">
            <img
              src={post.image_path}
              alt=""
              className="object-cover w-full h-full rounded-md"
            />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold mb-1 line-clamp-2">
            <a 
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600"
            >
              {post.title}
            </a>
          </h2>
          <div className="flex items-center text-xs text-gray-500">
            {post.site?.title && (
              <span className="truncate">
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
            {post.date_published && (
              <>
                <span className="mx-2">•</span>
                <time dateTime={post.date_published}>
                  {format(new Date(post.date_published), 'dd MMM')}
                </time>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
