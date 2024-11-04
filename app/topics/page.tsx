import { createClient } from '@/utils/supabase/server'

export default async function TopicsPage() {
  const supabase = await createClient()
      
  const { data: topics, error } = await supabase
    .from('content_topic')
    .select('id, name, slug, description')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching topics:', error)
    return <div>Error loading topics</div>
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Topics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topics?.map((topic) => (
          <div 
            key={topic.id} 
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-semibold">
              <a 
                href={`/topics/${topic.slug}`}
                className="hover:text-blue-600"
              >
                {topic.name}
              </a>
            </h2>
            {topic.description && (
              <p className="text-gray-600 mt-2 text-sm">{topic.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
