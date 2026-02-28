'use client'

import type { Database } from '@/types/supabase'

type Tool = Database['public']['Tables']['content_tool']['Row']

interface ToolCardProps {
  tool: Tool
}

function getToolImageUrl(image: string) {
  if (!image) return ''
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return ''
  return `https://res.cloudinary.com/${cloudName}/image/upload/${image}`
}

export function ToolCard({ tool }: ToolCardProps) {
  const imageUrl = getToolImageUrl(tool.image)

  return (

    <a
    href={`/tools/${tool.slug}`}
    className="group block transition-all duration-200 p-4 hover:bg-gray-50 hover:dark:bg-gray-900 h-full border-b sm:border-r"
    >
     
      <div className='flex flex-row gap-4'>
        <div className='flex-1'>
        <h3 className="font-bold mb-2 text-lg tracking-tight">
      {tool.title}
      </h3><p className="line-clamp-3 text-gray-500">
        {tool.description}
      </p></div>
      
      {imageUrl && (
        <img
          src={imageUrl}
          alt={tool.title}
          width={70}
          height={70}
          className="w-[70px] h-[70px] flex-none rounded object-cover"
          loading="lazy"
        />
      )}
      </div>
  
    </a>
  )
}
