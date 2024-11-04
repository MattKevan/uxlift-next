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

export function PostItemSmall({ post }: { post: PostWithSite }) {
  return (
    <article className="">
      <div className="flex gap-6">
        
        <div>
          <h2 className="text-xl font-semibold mb-2">
            <a 
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600"
            >
              {post.title}
            </a>
          </h2>

          <div className="text-sm text-gray-500 mb-2">
            {post.site?.title && (
              <span>
                
                {post.site.slug ? (
                  <Link 
                    href={`/sites/${post.site.slug}`}
                    className="hover:text-blue-600 mr-2"
                  >
                    {post.site.title}
                  </Link>
                ) : (
                  post.site.title
                )}
              </span>
            )}
            {post.date_published && (
              <span className="">
                {new Date(post.date_published).toLocaleDateString('en-GB', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'Europe/London'
                })}              
              </span>
            )}
          </div>

          <p className="text-gray-600 mb-3">{truncateToWords(post.description, 20)}</p>
          
        </div>
      </div>
    </article>
  )
}
