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
    .limit(12)

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
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
      <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">Tools</h1>
      </div>

      <div className='border-t grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4'>
          {uniqueTopics.map((topic) => (
            <div key={topic.id} 
            className="inline-block text-md sm:text-lg font-semibold tracking-tight border-b border-r"
          >
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}#tools`}
              className="hover:bg-gray-100  p-4 dark:hover:bg-gray-900 transition-all duration-200 block"

            >
            {topic.name}
                
            
            </Link>
            </div>
          ))}
        </div>
      <section className='mt-24'>
      <h2  className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">Latest tools</h2>
      <div className=" grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid ">
          {tools?.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>
    </main>
  )
}
