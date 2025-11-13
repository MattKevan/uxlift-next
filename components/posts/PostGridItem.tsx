import Link from 'next/link'
import { Database } from '@/types/supabase'
import { Bookmark, Flag, Like } from '@mynaui/icons-react'
import { Button } from '../catalyst/button'
import { format } from 'date-fns'

type BasePost = Database['public']['Tables']['content_post']['Row']
type Site = {
  title: string | null
  slug: string | null
}

type Topic = {
  id: number
  name: string | null
  slug: string | null
}

interface PostWithSite extends BasePost {
  site: Site | null
  topics?: Topic[]
}

function truncateToWords(str: string, numWords: number) {
  const words = str.trim().split(/\s+/)
  if (words.length <= numWords) return str
  return words.slice(0, numWords).join(' ') + '...'
}

export function PostGridItem({ post }: { post: PostWithSite }) {
  return (
    <div 
    className="flex flex-col h-full  rounded-lg overflow-hidden shadow hover:shadow-lg border transition-shadow duration-200">
       <a 
            href={post.link}
            target="_blank"
            rel="noopener noreferrer">
      {post.image_path && post.image_path.trim() !== '' ? (
        <div className="relative aspect-[16/9]">
          <img
            src={post.image_path}
            alt=""
            className="object-cover w-full h-full"
          />
        </div>
      ) : (
        <div className='relative aspect-[16/9] bg-blue-100'>
        </div>
      )}
      </a>
      <div className="flex flex-col flex-grow p-6">
        <h2 className="text-xl font-semibold leading-snug">
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
              {format(new Date(post.date_published), 'dd MMM yyyy')}
            </time>
          )}
        </p>
        
        <p className="mb-4 line-clamp-3">
          {post.description}
        </p>

        {post.topics && post.topics.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 font-mono">
            {post.topics.map((topic) => (
              topic.slug && (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors duration-200"
                >
                  {topic.name}
                </Link>
              )
            ))}
          </div>
        )}
        <div className="mt-auto text-sm text-gray-500 flex items-center justify-between">
          <div className='flex gap-2'>
            <Button plain>
              <Like />
            </Button>
            <Button plain>
            <Bookmark/>
            </Button>
            
          </div>
          <div>
            <Button plain>
            <Flag/>
            </Button>
          </div>
      
        </div>
      </div>
    </div>
  )
}
