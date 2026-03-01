import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata, ResolvingMetadata } from 'next'
import Markdown from 'react-markdown'
import Link from 'next/link'
import { ExternalLink } from '@mynaui/icons-react'

import { Tag } from '@/components/Tags'
import { Button } from '@/components/ui/button'
import { ResourceCard } from '@/components/ResourceCard'

type Topic = {
  id: number
  name: string
  slug: string
}

type ResourceWithRelations = {
  id: number
  title: string
  description: string
  summary: string
  body: string | null
  link: string
  image_path: string | null
  slug: string
  status: string
  date_created: string
  date_published: string | null
  user_id: number | null
  resource_category_id: number | null
  resource_category: {
    id: number
    name: string
    slug: string
  } | null
  content_resource_topics: {
    topic: Topic
  }[]
}

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

interface PageProps {
  params: Params
  searchParams: SearchParams
}

type MetadataProps = {
  params: Params
  searchParams: SearchParams
}

function getResourceImageUrl(imagePath: string | null) {
  if (!imagePath) return null
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return null
  return `https://res.cloudinary.com/${cloudName}/image/upload/${imagePath}`
}

async function getResourceData(slug: string) {
  const supabase = await createClient()

  const { data: resource, error } = await supabase
    .from('content_resource')
    .select(`
      *,
      resource_category:content_resource_category (
        id,
        name,
        slug
      ),
      content_resource_topics (
        topic:content_topic (
          id,
          name,
          slug
        )
      )
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !resource) {
    return null
  }

  return resource as ResourceWithRelations
}

export async function generateMetadata(
  { params }: MetadataProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  await parent
  const { slug } = await params
  const resource = await getResourceData(slug)
  const imageUrl = getResourceImageUrl(resource?.image_path || null)

  if (!resource) {
    return {
      title: 'Resource Not Found | UX Lift',
    }
  }

  return {
    title: `${resource.title} | UX Lift`,
    description: resource.description,
    openGraph: {
      title: `${resource.title} | UX Lift`,
      description: resource.description,
      url: `/resources/${resource.slug}`,
      siteName: 'UX Lift',
      type: 'website',
      images: imageUrl ? [imageUrl] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${resource.title} | UX Lift`,
      description: resource.description,
      images: imageUrl ? [imageUrl] : [],
    },
  }
}

export default async function ResourcePage({ params, searchParams }: PageProps) {
  await searchParams
  const { slug } = await params
  const resource = await getResourceData(slug)
  const imageUrl = getResourceImageUrl(resource?.image_path || null)

  if (!resource) {
    return notFound()
  }

  const supabase = await createClient()
  const topicIds = resource.content_resource_topics.map(({ topic }) => topic.id)

  let relatedResources: any[] = []

  if (topicIds.length > 0) {
    const { data: byTopic } = await supabase
      .from('content_resource')
      .select(`
        *,
        resource_category:content_resource_category (
          id,
          name,
          slug
        ),
        content_resource_topics!inner (
          topic_id
        )
      `)
      .in('content_resource_topics.topic_id', topicIds)
      .neq('id', resource.id)
      .eq('status', 'published')
      .order('date_published', { ascending: false, nullsFirst: false })
      .limit(9)

    relatedResources = byTopic || []
  }

  if (resource.resource_category_id) {
    const { data: sameCategory } = await supabase
      .from('content_resource')
      .select(`
        *,
        resource_category:content_resource_category (
          id,
          name,
          slug
        )
      `)
      .eq('resource_category_id', resource.resource_category_id)
      .neq('id', resource.id)
      .eq('status', 'published')
      .order('date_published', { ascending: false, nullsFirst: false })
      .limit(6)

    const combined = [...relatedResources, ...(sameCategory || [])]
    relatedResources = Array.from(new Map(combined.map((item) => [item.id, item])).values()).slice(0, 12)
  }

  return (
    <main>
      <div className="px-4 mb-24 sm:mb-32 mt-6">
        <div className="max-w-6xl">
          <div className="flex items-center gap-4 mb-6">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={resource.title || 'Resource image'}
                width={50}
                height={50}
                className="object-cover rounded"
              />
            )}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{resource.title}</h1>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {resource.resource_category && (
              <Link
                href={`/resources?category=${resource.resource_category.slug}`}
                className="border px-3 py-1 rounded-full text-sm text-gray-600 hover:bg-gray-200"
              >
                {resource.resource_category.name}
              </Link>
            )}

            {resource.content_resource_topics.map(({ topic }) => (
              <Tag key={topic.id} href={`/topics/${topic.slug}`} text={topic.name} />
            ))}
          </div>

          <p className="text-xl mb-4 tracking-tight text-gray-500 dark:text-gray-300">{resource.description}</p>

          {resource.summary && (
            <p className="text-lg mb-6 text-gray-600 dark:text-gray-300 max-w-4xl">{resource.summary}</p>
          )}

          <div className="mb-8">
            <Button asChild>
              <Link href={resource.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2" />
                Visit resource
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {resource.body && (
        <div className="mb-10 sm:mb-18 pt-12 border-t">
          <div className="prose prose-lg dark:prose-invert max-w-6xl px-4">
            <Markdown>{resource.body}</Markdown>
          </div>
        </div>
      )}

      {relatedResources.length > 0 && (
        <section className="mt-16">
          <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
            Related resources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {relatedResources.map((relatedResource) => (
              <ResourceCard key={relatedResource.id} resource={relatedResource} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
