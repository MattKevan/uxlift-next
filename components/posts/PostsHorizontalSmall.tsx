'use client'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { CldImage } from 'next-cloudinary'
import { Bookmark, ExternalLink, Flag, Like, LinkOne } from '@mynaui/icons-react'
import clsx from 'clsx'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type BasePost = Database['public']['Tables']['content_post']['Row']
type Site = {
  title: string | null
  slug: string | null
  site_icon: string | null
}
type Topic = {
  id: number
  name: string
  slug: string
}
type PostTopic = {
  topic: Topic
}

interface PostWithSite extends BasePost {
  site: Site | null
  content_post_topics: PostTopic[]
}
function truncateToWords(str: string, numWords: number) {
  const words = str.trim().split(/\s+/)
  if (words.length <= numWords) return str
  return words.slice(0, numWords).join(' ') + '...'
}



export function PostHorizontal({ post }: { post: PostWithSite }) {

  return (
    
    <article className={clsx(
      "overflow-hidden grid gap-6 group hover:bg-gray-50 p-4 md:odd:border-r border-b transition duration-200",
      post.image_path ? "grid-cols-5" : "grid-cols-1"
    )}>
      <div className={clsx(
        "flex flex-col flex-grow justify-between",
        post.image_path ? "col-span-3" : "col-span-1"
      )}>
        <div>
          <div className='flex flex-row justify-between items-center mb-2'>
            <p className="text-sm font-mono flex flex-row items-center gap-1">
              {post.site?.site_icon && (
                <CldImage
                  src={post.site.site_icon || '/default-avatar.png'}
                  alt={post.site?.title || 'Site icon'}
                  width={70}
                  height={70}
                  className="size-5 flex-none rounded-full"
                />
              )}
              {post.site?.title && (
                <span className='font-semibold text-gray-600'>
                  {post.site.slug ? (
                    <Link href={`/sites/${post.site.slug}`} className='hover:underline'>{post.site.title}</Link>
                  ) : (
                    post.site.title
                  )}
                </span> 
              )}
            </p>
            {post.date_published && (
              <time dateTime={post.date_published} className='text-gray-400 text-xs'>
                {new Date(post.date_published).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Europe/London'
                })}
              </time>
            )}
          </div>
          <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold mb-3 tracking-tight leading-tight md:leading-tight">
            <a 
              href={`/articles/${post.slug}`}
       
            >
              {post.title}
            </a>

          </h2>
          {post.content_post_topics && post.content_post_topics.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {post.content_post_topics.map(({ topic }) => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="mt-auto pt-4 text-sm text-gray-400 items-center gap-2 flex">
          <div>
        <TooltipProvider>
  <Tooltip>
    <TooltipTrigger>
        <Link href={post.link}  target="_blank" rel="noopener noreferrer" className='text-primary hover:text-gray-500'><ExternalLink/>
            </Link>
          
          </TooltipTrigger>
    <TooltipContent>
      <p>Read the full article</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
</div>

        </div>
      </div>

      {post.image_path && (
        <div className="relative aspect-square col-span-2 mb-0">
          <a 
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            <img 
              src={post.image_path} 
              alt=""
              className="object-cover w-full h-full inset-0"
            />
          </a>   
        </div>
      )}
    </article>
  )
}
