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
    <div className="max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Topics</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {topics?.map((topic) => (
          <div 
            key={topic.id} 
            className=""
          >
            <h2 className="text-lg font-serif ">
              <a 
                href={`/topics/${topic.slug}`}
                className="text-blue-600 hover:underline"
              >
                {topic.name}
              </a>
            </h2>
           
          </div>
        ))}
      </div>
    </div>
  )
}
