import { createClient } from '@/utils/supabase/server'

export default async function SitesPage() {
    const supabase = await createClient()
      
    const { data: sites, error } = await supabase
      .from('content_site')
      .select('id, title, description, slug')
      .order('title', { ascending: true })

    console.log('Sites data:', sites) // Debug log
    console.log('Error:', error)      // Debug log

    if (error) {
      console.error('Error fetching sites:', error)
      return <div>Error loading sites</div>
    }

    if (!sites || sites.length === 0) {
      return (
        <div className="max-w-4xl mx-auto py-8 px-4">
          <h1 className="text-3xl font-bold mb-8">Sites</h1>
          <p>No sites found in the database.</p>
        </div>
      )
    }

    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">Sites</h1>
        
        <div className="space-y-4">
          {sites.map((site) => (
            <div key={site.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <h2 className="text-xl font-semibold">
                <a 
                  href={`/sites/${site.slug}`}
                  className="hover:text-blue-600"
                >
                  {site.title}
                </a>
              </h2>
              {site.description && (
                <p className="text-gray-600 mt-2">{site.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    )
}
