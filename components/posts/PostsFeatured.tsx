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

function truncateToWords(str: string, numWords: number) {
  const words = str.trim().split(/\s+/)
  if (words.length <= numWords) return str
  return words.slice(0, numWords).join(' ') + '...'
}

export function PostFeatured({ post }: { post: PostWithSite }) {
  return (
    <article className="bg-white rounded-lg border overflow-hidden shadow hover:shadow-lg transition-shadow duration-200">
      <div className='grid grid-cols-1 md:grid-cols-3'>
        {post.image_path && post.image_path.trim() !== '' ? (
          <div className="relative aspect-[16/9] md:col-span-2">
            <img
              src={post.image_path}
              alt=""
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="relative aspect-[16/9] md:col-span-2 bg-blue-100">
          </div>
        )}

        <div className="p-8 md:col-span-1">
              <h2 className="text-2xl font-bold mb-4">
                <a 
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600"
                >
                  {post.title}
                </a>
              </h2>
              <p className=" mb-6 text-lg line-clamp-3">
                {post.description}
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
                    {format(new Date(post.date_published), 'dd MMM yyyy')}
                  </time>
                )}
              </div>
        </div>

      </div>

   
    </article>
  )
}
