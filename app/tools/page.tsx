// /app/tools/page.tsx

import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { Divider } from '@/components/catalyst/divider'
import { ToolCard } from '@/components/ToolCards'

type Topic = Database['public']['Tables']['content_topic']['Row']
type Tool = Database['public']['Tables']['content_tool']['Row']

export default async function ToolsPage() {
  const supabase = await createClient()

  // Get topics that have tools associated with them using a different approach
  const { data: topics, error: topicsError } = await supabase
    .from('content_topic')
    .select(`
      *,
      content_tool_topics!inner (
        tool_id
      )
    `)
    .order('name')

  // Get 9 most recent tools
  const { data: tools, error: toolsError } = await supabase
    .from('content_tool')
    .select()
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(9)

  if (topicsError) {
    console.error('Error fetching topics:', topicsError)
    return <div>Error loading topics</div>
  }

  if (toolsError) {
    console.error('Error fetching tools:', toolsError)
    return <div>Error loading tools</div>
  }

  // Remove duplicate topics (since a topic might have multiple tools)
  const uniqueTopics = Array.from(new Map(topics?.map(topic => [topic.id, topic])).values())

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <h1 className='text-6xl font-bold'>Tools</h1>
      <Divider className='my-12' />
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Explore tools</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uniqueTopics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}#tools`}
              className="block"
            >
              <h4 className="mb-1 font-serif hover:underline text-lg text-blue-600">{topic.name}</h4>
                
            
            </Link>
          ))}
        </div>
      </section>
          <Divider className='my-12' />
      <section>
        <h2 className="text-2xl font-bold mb-6">Latest Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools?.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />

          ))}
        </div>
      </section>
    </div>
  )
}
