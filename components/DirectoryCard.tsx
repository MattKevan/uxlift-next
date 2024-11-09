'use client'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { CldImage } from 'next-cloudinary'
import { Button } from '@/components/catalyst/button'

type Site = Database['public']['Tables']['content_site']['Row']

export function DirectoryCard({ site }: { site: Site }) {
  return (
    <div className="p-6 border-b border-r">
      <div className="flex items-start gap-4">
        {site.site_icon && (
          <CldImage
            src={site.site_icon}
            alt={site.title}
            width={70}
            height={70}
            className="size-16 flex-none rounded-lg"
          />
        )}
        <div className="flex flex-col flex-grow">
          <h2 className="text-xl font-bold mb-2">
            <Link href={`/sites/${site.slug}`} className="hover:underline">
              {site.title}
            </Link>
          </h2>
          {site.description && (
            <p className="text-gray-600 text-sm mb-4">
              {site.description}
            </p>
          )}
          <div className="flex gap-2 mt-auto">
            <Button href={`/sites/${site.slug}`} color="white">
              View articles
            </Button>
            <Button 
              href={site.url} 
              target="_blank" 
              rel="noopener noreferrer"
              color="white"
            >
              Visit site
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
