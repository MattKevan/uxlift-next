import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ResourceCard } from '@/components/ResourceCard'
import type { Database } from '@/types/supabase'
import type { Metadata } from 'next'

type Category = Database['public']['Tables']['content_resource_category']['Row']
type Resource = Database['public']['Tables']['content_resource']['Row']

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ category?: string }>

interface PageProps {
  params: Params
  searchParams: SearchParams
}

export const metadata: Metadata = {
  title: 'Resources | UX Lift',
  description: 'Discover UX resources including fonts, icon libraries, UI kits, and design systems.',
}

export default async function ResourcesPage({ params, searchParams }: PageProps) {
  await params
  const { category } = await searchParams
  const supabase = await createClient()

  const { data: categories, error: categoriesError } = await supabase
    .from('content_resource_category')
    .select('*')
    .order('sort_order', { ascending: true })

  if (categoriesError) {
    console.error('Error fetching resource categories:', categoriesError)
    return <div>Error loading resource categories</div>
  }

  let selectedCategoryId: number | null = null
  if (category) {
    selectedCategoryId = categories?.find((item) => item.slug === category)?.id || null
  }

  let resourceQuery = supabase
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

  if (category) {
    if (selectedCategoryId) {
      resourceQuery = resourceQuery.eq('resource_category_id', selectedCategoryId)
    } else {
      resourceQuery = resourceQuery.eq('resource_category_id', -1)
    }
  }

  const { data: resources, error: resourcesError } = await resourceQuery

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
        .map((topic: any) => [topic.id, topic])
    ).values()
  )

  return (
    <main>
      <div className="px-6 mb-10 sm:mb-18 mt-6">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          Resources
          <span className="text-gray-500 ml-3">Fonts, foundries, icon libraries, UI kits, and toolkits</span>
        </h1>
      </div>

      <section className="mb-8">
        <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
          Filter by resource category
        </h2>
        <div className="p-4 border-b flex flex-wrap gap-2">
          <Link
            href="/resources"
            className={`px-3 py-1 rounded-full text-sm border ${!category ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'hover:bg-gray-100 dark:hover:bg-gray-900'}`}
          >
            All
          </Link>
          {(categories || []).map((resourceCategory) => (
            <Link
              key={resourceCategory.id}
              href={`/resources?category=${resourceCategory.slug}`}
              className={`px-3 py-1 rounded-full text-sm border ${category === resourceCategory.slug ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'hover:bg-gray-100 dark:hover:bg-gray-900'}`}
            >
              {resourceCategory.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
          Browse by topic
        </h2>
        <div className="p-4 border-b flex flex-wrap gap-2">
          {uniqueTopics.map((topic: any) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}#resources`}
              className="px-3 py-1 rounded-full text-sm border hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              {topic.name}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
          {resources?.length || 0} resources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {(resources || []).map((resource: any) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>

        {resources?.length === 0 && (
          <p className="text-gray-600 p-4">No resources found for this filter.</p>
        )}
      </section>
    </main>
  )
}
