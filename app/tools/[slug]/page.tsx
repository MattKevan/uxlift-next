import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { Database } from '@/types/supabase'
import { Metadata, ResolvingMetadata } from 'next'
import Markdown from 'react-markdown'
import { Tag } from '@/components/Tags'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CustomImage } from '@/components/Image'
import { ExternalLink } from '@mynaui/icons-react'
import { ToolCard } from '@/components/ToolCards'

type Tool = Database['public']['Tables']['content_tool']['Row']

type Topic = {
  id: number
  name: string
  slug: string
}

type ToolTopic = {
  topic: Topic
}

interface ToolWithTopics extends Tool {
  content_tool_topics: ToolTopic[]
}

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

interface PageProps {
  params: Params
  searchParams: SearchParams
}

async function getToolData(slug: string) {
  const supabase = await createClient()
  
  const { data: tool, error } = await supabase
    .from('content_tool')
    .select(`
      *,
      content_tool_topics (
        topic:content_topic (
          id,
          name,
          slug
        )
      )
    `)
    .eq('slug', slug)
    .single()

  if (error || !tool) {
    return null
  }

  return tool as ToolWithTopics
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params
  const tool = await getToolData(slug)

  if (!tool) {
    return {
      title: 'Tool Not Found | UX Lift',
    }
  }

  return {
    title: `${tool.title} | UX Lift`,
    description: tool.description,
    openGraph: {
      title: `${tool.title} | UX Lift`,
      description: tool.description,
      url: `/tools/${tool.slug}`,
      siteName: 'UX Lift',
      type: 'website',
      images: [tool.image],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tool.title} | UX Lift`,
      description: tool.description,
      images: [tool.image],
    },
  }
}

export default async function ToolPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const tool = await getToolData(slug)

  if (!tool) {
    return notFound()
  }

  // Get related tools with same topics
  const supabase = await createClient()
  const topicIds = tool.content_tool_topics.map(({ topic }) => topic.id)

  const { data: relatedTools } = await supabase
    .from('content_tool')
    .select(`
      *,
      content_tool_topics!inner (
        topic:content_topic (
          id,
          name,
          slug
        )
      )
    `)
    .in('content_tool_topics.topic_id', topicIds)
    .neq('id', tool.id)
    .eq('status', 'published')
    .order('date', { ascending: false })

  return (
    <main>
      <div className='px-4 mb-24 sm:mb-32 mt-6'>
        <div className='max-w-6xl'>
          <div className="flex items-center gap-4 mb-6">
            {tool.image && (
              <CustomImage
                src={tool.image}
                alt={tool.title || 'Tool logo'}
                width={50}
                height={50}
                className="object-cover"
                fallback="/images/default-site-icon.png"
                priority
              />
            )}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {tool.title}
            </h1>
          </div>

          {tool.content_tool_topics.length > 0 && (
            <div className="flex gap-2 mb-6">
              {tool.content_tool_topics.map(({ topic }) => (
                <Tag 
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  text={topic.name}
                />
              ))}
            </div>
          )}

          <p className="text-xl mb-6 tracking-tight text-gray-500 dark:text-gray-300">
            {tool.description}
          </p>

          <div className="mb-8">
            <Button asChild>
              <Link
                href={tool.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2" />
                Visit website
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {tool.body && (
        <div className="mb-10 sm:mb-18 pt-12 border-t">
          <div className="prose prose-lg dark:prose-invert max-w-6xl px-4">
            <Markdown>{tool.body}</Markdown>
          </div>
        </div>
      )}

      {relatedTools && relatedTools.length > 0 && (
        <section className="mt-16">
          <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
            Related Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {relatedTools.map((relatedTool) => (
              <ToolCard key={relatedTool.id} tool={relatedTool} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}