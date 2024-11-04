import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Database } from '@/types/supabase'

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
    <div className="max-w-6xl mx-auto py-8 px-4">
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Topics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uniqueTopics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-semibold mb-1">{topic.name}</h3>
              {topic.description && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {topic.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Latest Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools?.map((tool) => (
            <a
              key={tool.id}
              href={tool.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <div className="aspect-video mb-3 overflow-hidden rounded-lg">
                <img
                  src={tool.image}
                  alt={tool.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <h3 className="font-semibold mb-2 group-hover:text-blue-600">
                {tool.title}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {tool.description}
              </p>
              <div className="text-xs text-gray-500 mt-2">
                {new Date(tool.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
