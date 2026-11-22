import { Suspense } from 'react'
import { createPublicClient } from '@/utils/supabase/public'
import ResourceBrowser from '@/components/resources/ResourceBrowser'
import type { Metadata } from 'next'

export const revalidate = false

export const metadata: Metadata = {
  title: 'Resources | UX Lift',
  description: 'Discover UX resources including fonts, icon libraries, UI kits, and design systems.',
}

export default async function ResourcesPage() {
  const supabase = createPublicClient()

  const { data: categories, error: categoriesError } = await supabase
    .from('content_resource_category')
    .select('*')
    .order('sort_order', { ascending: true })

  if (categoriesError) {
    console.error('Error fetching resource categories:', categoriesError)
    return <div>Error loading resource categories</div>
  }

  const { data: resources, error: resourcesError } = await supabase
    .from('content_resource')
    .select(`
      *,
      resource_category:content_resource_category (
        id,
        name,
        slug
      )
    `)
    .eq('status', 'published')
    .order('date_published', { ascending: false, nullsFirst: false })

  if (resourcesError) {
    console.error('Error fetching resources:', resourcesError)
    return <div>Error loading resources</div>
  }

  const { data: topicRefs, error: topicsError } = await supabase
    .from('content_resource_topics')
    .select(`
      topic:content_topic (
        id,
        name,
        slug
      ),
      resource:content_resource!inner (
        status
      )
    `)
    .eq('resource.status', 'published')

  if (topicsError) {
    console.error('Error fetching resource topics:', topicsError)
    return <div>Error loading topics</div>
  }

  const uniqueTopics = Array.from(
    new Map(
      (topicRefs || [])
        .map((row: any) => row.topic)
        .filter(Boolean)
        .map((topic: any) => [topic.id, topic]),
    ).values(),
  )

  return (
    <main>
      <div className="px-6 mb-10 sm:mb-18 mt-6">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          Resources
          <span className="text-gray-500 ml-3">Fonts, foundries, icon libraries, UI kits, and toolkits</span>
        </h1>
      </div>

      <Suspense fallback={<div className="h-24 animate-pulse bg-gray-100/60 dark:bg-gray-900/60" />}>
        <ResourceBrowser
          categories={categories ?? []}
          resources={resources ?? []}
          topics={uniqueTopics}
        />
      </Suspense>
    </main>
  )
}
