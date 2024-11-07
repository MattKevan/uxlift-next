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
    <main>
      <div className='px-6 mb-24 sm:mb-32 mt-6'>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">Topics</h1>
      </div>

      <div className='border-t grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4'>
        {topics?.map((topic) => (
          <div key={topic.id} 
            className="inline-block text-md sm:text-xl  font-semibold border-b border-r tracking-tight"
          >
            <a 
              href={`/topics/${topic.slug}`}
              className="dark:hover:text-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 p-4 sm:p-6 dark:hover:bg-gray-900 transition-all duration-200 block"
            >
              {topic.name}
            </a>
          </div>
        ))}
      </div>
    </main>
  )
}
