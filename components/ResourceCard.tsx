'use client'

import type { Database } from '@/types/supabase'

type Resource = Database['public']['Tables']['content_resource']['Row']

type ResourceCategory = {
  id: number
  name: string
  slug: string
}

interface ResourceCardProps {
  resource: Resource & {
    resource_category?: ResourceCategory | null
  }
}

function getResourceImageUrl(imagePath: string | null) {
  if (!imagePath) return ''

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return ''
  return `https://res.cloudinary.com/${cloudName}/image/upload/${imagePath}`
}

export function ResourceCard({ resource }: ResourceCardProps) {
  const imageUrl = getResourceImageUrl(resource.image_path)

  return (
    <a
      href={`/resources/${resource.slug}`}
      className="group block transition-all duration-200 p-4 hover:bg-gray-50 hover:dark:bg-gray-900 h-full border-b sm:border-r"
    >
      <div className="flex flex-row gap-4">
        <div className="flex-1">
          <h3 className="font-bold mb-2 text-lg tracking-tight">{resource.title}</h3>
          {resource.resource_category && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs border mb-2">
              {resource.resource_category.name}
            </span>
          )}
          <p className="line-clamp-3 text-gray-500">{resource.description}</p>
        </div>

        {imageUrl && (
          <img
            src={imageUrl}
            alt={resource.title}
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
