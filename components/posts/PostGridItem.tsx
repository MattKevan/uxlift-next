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
    <a 
    href={post.link} className="flex flex-col h-full  rounded-lg overflow-hidden shadow hover:shadow-lg border transition-shadow duration-200">
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
        <h2 className="text-lg font-semibold leading-snug">
          <a 
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600"
          >
            {post.title}
          </a>
        </h2>
        <p className="text-sm font-mono my-3">
          {post.site?.title && (
            <span className='mr-1'>
              {post.site.slug ? (
                <Link href={`/sites/${post.site.slug}`} className='hover:underline'>{post.site.title} -</Link>
              ) : (
                post.site.title
              )}
            </span> 
          )}
          {post.date_published && (
            <time dateTime={post.date_published} >
              {new Date(post.date_published).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Europe/London'
              })}
            </time>
          )}
        </p>
        
        <p className="mb-4 line-clamp-3">
          {post.description}
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
      
        </div>
      </div>
    </a>
  )
}
