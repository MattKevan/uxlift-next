import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import type { Metadata } from 'next'
import { CldImage } from 'next-cloudinary'
import { DirectoryCard } from '@/components/DirectoryCard'
type Site = Database['public']['Tables']['content_site']['Row']

export const metadata: Metadata = {
  title: 'Publications | UX Lift',
  description: 'Browse UX and design publications',
}

export default async function PublicationsPage() {
  const supabase = await createClient()
  
  // Get sites that are tagged as publications
  const { data: publications, error } = await supabase
    .from('content_site')
    .select(`
      *,
      content_site_site_type!inner(
        sitetype:content_sitetype(*)
      )
    `)
    .eq('content_site_site_type.sitetype.slug', 'publication')
    .eq('status', 'P')
    .order('title')

  if (error) {
    console.error('Error fetching publications:', error)
    return <div>Error loading publications</div>
  }

  return (
    <main>
      <div className='px-6 mb-10 sm:mb-18 mt-6'>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          Publications
          <span className="text-gray-500 ml-3">
            UX and design publications
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t">
        {publications?.map((site) => (
                    <DirectoryCard key={site.id} site={site} />

        ))}
      </div>
    </main>
  )
}
