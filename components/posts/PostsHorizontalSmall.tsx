'use client'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { CldImage } from 'next-cloudinary'
import { Bookmark, Flag, Like } from '@mynaui/icons-react'
import { Button } from '../catalyst/button'
import clsx from 'clsx'

type BasePost = Database['public']['Tables']['content_post']['Row']
type Site = {
  title: string | null
  slug: string | null
  site_icon: string | null
}

interface PostWithSite extends BasePost {
  site: Site | null
}

function truncateToWords(str: string, numWords: number) {
  const words = str.trim().split(/\s+/)
  if (words.length <= numWords) return str
  return words.slice(0, numWords).join(' ') + '...'
}

export function PostHorizontal({ post }: { post: PostWithSite }) {
  return (
    <article className={clsx(
      "overflow-hidden grid gap-6 group",
      post.image_path ? "grid-cols-3" : "grid-cols-1"
    )}>
      <div className={clsx(
        "flex flex-col flex-grow justify-between",
        post.image_path ? "col-span-2" : "col-span-1"
      )}>
        <div>
          <div className='flex flex-row justify-between items-center mb-2'>
            <p className="text-sm font-mono flex flex-row items-center gap-2">
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
          <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold mb-2 tracking-tight leading-tight md:leading-tight">
            <a 
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {post.title}
            </a>
          </h2>
        </div>
        <div className="mt-auto text-sm text-gray-400 items-center gap-2 flex">
          <Like />
          <Bookmark />
        </div>
      </div>

      {post.image_path && (
        <div className="relative aspect-square col-span-1 mb-0">
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
