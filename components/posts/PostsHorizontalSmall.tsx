'use client'
import Link from 'next/link'
import { CldImage } from 'next-cloudinary'
import { ExternalLink } from '@mynaui/icons-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

interface PostWithSite {
  id: number
  slug: string | null
  title: string | null
  date_published: string | null
  link: string
  image_path: string | null
  site: Site | null
  content_post_topics: PostTopic[]
}

function getDisplayTitle(title: string | null) {
  const trimmedTitle = title?.trim()
  return trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : 'this article'
}

function getProxiedImageSrc(imagePath: string) {
  if (imagePath.startsWith('/')) return imagePath

  try {
    const parsedUrl = new URL(imagePath)
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return `/api/image-proxy?url=${encodeURIComponent(imagePath)}`
    }
  } catch {
    return imagePath
  }

  return imagePath
}


export function PostHorizontal({ post }: { post: PostWithSite }) {
  const hasValidImage = Boolean(post.image_path && post.image_path.trim() !== '')
  const displayTitle = getDisplayTitle(post.title)
  const proxiedImageSrc = hasValidImage && post.image_path ? getProxiedImageSrc(post.image_path) : null

  return (

    <article className={clsx(
      "overflow-hidden grid gap-6 group hover:bg-gray-50 dark:hover:bg-gray-900 p-4 md:odd:border-r border-b transition duration-200",
      hasValidImage ? "grid-cols-5" : "grid-cols-1"
    )}>
      <div className={clsx(
        "flex flex-col flex-grow justify-between",
        hasValidImage ? "col-span-3" : "col-span-1"
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
              <time dateTime={post.date_published} className='text-gray-600 dark:text-gray-300 text-xs'>
                {format(new Date(post.date_published), 'dd MMM yyyy')}
              </time>
            )}
          </div>
          <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold mb-3 tracking-tight leading-tight md:leading-tight">
            <a 
              href={`/articles/${post.slug}`}
              className="hover:underline"
            >
              {displayTitle}
            </a>

          </h2>
          {post.content_post_topics && post.content_post_topics.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {post.content_post_topics.map(({ topic }) => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 hover:dark:bg-gray-700 transition-colors"
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
    <TooltipTrigger asChild>
        <Link
          href={post.link}
          target="_blank"
          rel="noopener noreferrer"
          className='text-primary hover:text-gray-500'
          aria-label={`Read full article: ${displayTitle} (opens in a new tab)`}
        >
          <ExternalLink aria-hidden="true" />
          <span className="sr-only">Read full article</span>
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

      {hasValidImage && post.slug && (
        <div className="relative aspect-square col-span-2 mb-0">
          <a
            href={`/articles/${post.slug}`}
            className="hover:underline"
            aria-label={`Read article: ${displayTitle}`}
          >
            <img
              src={proxiedImageSrc || undefined}
              alt={`Thumbnail for ${displayTitle}`}
              className="object-cover w-full h-full inset-0"
              loading="lazy"
            />
          </a>
        </div>
      )}
    </article>
  )
}
