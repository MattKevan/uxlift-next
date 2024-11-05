'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import type { Database } from '@/types/supabase'
import EditSiteModal from '@/components/EditSiteModal'

type Site = Database['public']['Tables']['content_site']['Row']
type SiteType = Database['public']['Tables']['content_sitetype']['Row']
type SiteWithRelations = Site & {
  content_site_site_type: {
    content_sitetype: SiteType
  }[]
}

const SITES_PER_PAGE = 50

export default function AdminSites() {
  const [sites, setSites] = useState<SiteWithRelations[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const supabase = createClient()
  const [selectedSite, setSelectedSite] = useState<SiteWithRelations | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchSites = async () => {
    const { data: sitesData, count: totalCount } = await supabase
      .from('content_site')
      .select(`
        *,
        content_site_site_type (
          content_sitetype (
            id,
            name,
            slug
          )
        )
      `, { count: 'exact' })
      .order('title', { ascending: true })
      .range((currentPage - 1) * SITES_PER_PAGE, currentPage * SITES_PER_PAGE - 1)

    if (sitesData) {
      setSites(sitesData as SiteWithRelations[])
    }
    if (totalCount !== null) {
      setCount(totalCount)
    }
  }

  useEffect(() => {
    fetchSites()
  }, [currentPage])

  const toggleNewsfeedInclusion = async (siteId: number, currentValue: boolean) => {
    const { error } = await supabase
      .from('content_site')
      .update({ include_in_newsfeed: !currentValue })
      .eq('id', siteId)

    if (!error) {
      setSites(sites.map(site =>
        site.id === siteId
          ? { ...site, include_in_newsfeed: !currentValue }
          : site
      ))
    } else {
      console.error('Error updating site:', error)
    }
  }

  const handleEdit = (site: SiteWithRelations) => {
    setSelectedSite(site)
    setIsModalOpen(true)
  }

  const handleUpdate = (updatedSite: SiteWithRelations) => {
    setSites(sites.map(site => 
      site.id === updatedSite.id ? updatedSite : site
    ))
  }

  const totalPages = Math.ceil(count / SITES_PER_PAGE)

  return (
    <div className="">
      <h1 className="text-2xl font-bold mb-6">Manage Sites</h1>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-lg dark:bg-gray-800 dark:border-gray-700 font-sans">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Feed URL</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site Types</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">In Newsfeed</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>

            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sites.map((site) => (
              <tr key={site.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium dark:text-white">{site.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                      {site.description}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <a 
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {site.url}
                  </a>
                </td>
                <td className="px-6 py-4">
                  {site.feed_url ? (
                    <a 
                      href={site.feed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      RSS Feed
                    </a>
                  ) : (
                    <span className="text-gray-500">No feed</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {site.content_site_site_type.map(({ content_sitetype }) => (
                      <span 
                        key={content_sitetype.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      >
                        {content_sitetype.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    site.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    site.status === 'inactive' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {site.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleNewsfeedInclusion(site.id, site.include_in_newsfeed)}
                    className={`px-2 py-1 rounded-full text-xs ${
                      site.include_in_newsfeed
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {site.include_in_newsfeed ? 'Included' : 'Excluded'}
                  </button>
                </td>
                <td className="px-6 py-4">
        <div className="flex space-x-2">
          <button
            onClick={() => handleEdit(site)}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Edit
          </button>
          <button
            onClick={() => toggleNewsfeedInclusion(site.id, site.include_in_newsfeed)}
            className={`px-2 py-1 rounded-full text-xs ${
              site.include_in_newsfeed
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {site.include_in_newsfeed ? 'Included' : 'Excluded'}
          </button>
        </div>
      </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {((currentPage - 1) * SITES_PER_PAGE) + 1} to {Math.min(currentPage * SITES_PER_PAGE, count)} of {count} results
        </div>
        <div className="flex space-x-2">
          {currentPage > 1 && (
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-3 py-2 border rounded hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Previous
            </button>
          )}
          {currentPage < totalPages && (
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-3 py-2 border rounded hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Next
            </button>
          )}
        </div>
      </div>
      {selectedSite && (
        <EditSiteModal
          site={selectedSite}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedSite(null)
          }}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
