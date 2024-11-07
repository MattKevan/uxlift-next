'use client'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { CldImage } from 'next-cloudinary'
import { Bookmark, Flag, Like } from '@mynaui/icons-react'
import { Button } from '../catalyst/button'

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
    <article className="overflow-hidden grid grid-cols-3 gap-6 group">
      
      <a 
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >

         
      <div className=" relative aspect-square :col-span-1 mb-0">

      {post.image_path && (
          <img 
            src={post.image_path} 
            alt=""
            className="object-cover w-full h-full inset-0"
          />
      )}
              </div>
              </a>    

      <div className="flex flex-col col-span-2 flex-grow">
        <h2 className="text-xl md:text-2xl font-bold mb-2 tracking-tight leading-tight md:leading-tight">
          <a 
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {post.title}
          </a>
        </h2>
        <p className="text-gray-500 mb-2 line-clamp-2">
          {post.description}
        </p>
        <p className="text-sm font-mono my-3 flex flex-row items-center gap-2">

        {post.site?.site_icon && (
             <CldImage
             src={post.site.site_icon || '/default-avatar.png'}
             alt={post.site?.title || 'Site icon'}
             width={70}
             height={70}
             className="size-8 flex-none rounded-full"
           />
           
          )}
                  {post.site?.title && (

            <span className='font-semibold'>
              {post.site.slug ? (
                <Link href={`/sites/${post.site.slug}`} className='hover:underline'>{post.site.title}</Link>
              ) : (
                post.site.title
              )}
            </span> 
          )}
          {post.date_published && (
            <time dateTime={post.date_published} className='text-gray-400'>
              {new Date(post.date_published).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Europe/London'
              })}
            </time>
          )}
        </p>
        <div className="mt-auto text-sm text-gray-400 items-center justify-between flex">
          <div className='flex gap-2'>
<Button outline className='text-gray-500'>      
   <Like />
</Button>      
<Button outline>      

            <Bookmark />
            </Button>
          </div>
          <div>
          <Button outline>      

            <Flag />
            </Button>
          </div>
      
        </div>
      </div>
    </article>
  )
}
