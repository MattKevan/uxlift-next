'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import type { Database } from '@/types/supabase'
import EditResourceModal from '@/components/EditResourceModal'
import { format, isValid, parseISO } from 'date-fns'

type Resource = Database['public']['Tables']['content_resource']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type ResourceCategory = Database['public']['Tables']['content_resource_category']['Row']

type ResourceWithRelations = Resource & {
  resource_category: ResourceCategory | null
  content_resource_topics: {
    content_topic: Topic
  }[]
}

interface BulkUploadSummary {
  total: number
  created: number
  existing: number
  failed: number
  results: Array<{
    url: string
    status: 'created' | 'existing' | 'failed'
    resourceId?: number
    title?: string
    error?: string
  }>
}

const RESOURCES_PER_PAGE = 50
type SortField = 'date_published'
type SortDirection = 'asc' | 'desc'

function extractUrlsFromCsv(content: string): string[] {
  const urlMatches = content.match(/https?:\/\/[^\s",]+/g) || []
  return Array.from(
    new Set(
      urlMatches
        .map((url) => url.trim().replace(/[)\];]+$/, ''))
        .filter(Boolean)
    )
  )
}

function getStatusLabel(status: string) {
  if (status === 'P' || status === 'published') return 'Published'
  if (status === 'D' || status === 'draft') return 'Draft'
  if (status === 'archived') return 'Archived'
  return status
}

function getStatusClasses(status: string) {
  if (status === 'P' || status === 'published') {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }
  if (status === 'D' || status === 'draft') {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  }
  if (status === 'archived') {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
}

function formatResourceDate(dateString: string | null | undefined) {
  if (!dateString) return '—'

  try {
    const parsedDate = parseISO(dateString)
    if (!isValid(parsedDate)) return '—'
    return format(parsedDate, 'dd/MM/yyyy')
  } catch {
    return '—'
  }
}

export default function AdminResources() {
  const [resources, setResources] = useState<ResourceWithRelations[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const supabase = createClient()
  const [selectedResource, setSelectedResource] = useState<ResourceWithRelations | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isBulkUploading, setIsBulkUploading] = useState(false)
  const [bulkSummary, setBulkSummary] = useState<BulkUploadSummary | null>(null)
  const [bulkError, setBulkError] = useState('')
  const [sortField, setSortField] = useState<SortField>('date_published')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const fetchResources = async () => {
    let query = supabase
      .from('content_resource')
      .select(
        `
        *,
        resource_category:content_resource_category (
          id,
          name,
          slug
        ),
        content_resource_topics (
          content_topic (
            id,
            name,
            slug
          )
        )
      `,
        { count: 'exact' }
      )

    if (sortField === 'date_published') {
      query = query.order('date_published', {
        ascending: sortDirection === 'asc',
        nullsFirst: false,
      })
    }

    const { data: resourcesData, count: totalCount } = await query
      .order('id', { ascending: false })
      .range((currentPage - 1) * RESOURCES_PER_PAGE, currentPage * RESOURCES_PER_PAGE - 1)

    if (resourcesData) {
      setResources(resourcesData as ResourceWithRelations[])
    }
    if (totalCount !== null) {
      setCount(totalCount)
    }
  }

  useEffect(() => {
    fetchResources()
  }, [currentPage, sortField, sortDirection])

  const handleDateSort = () => {
    if (sortField !== 'date_published') {
      setSortField('date_published')
      setSortDirection('desc')
      return
    }

    setSortDirection((currentDirection) => (currentDirection === 'desc' ? 'asc' : 'desc'))
  }

  const handleEdit = (resource: ResourceWithRelations) => {
    setSelectedResource(resource)
    setIsEditModalOpen(true)
  }

  const handleUpdate = (updatedResource: ResourceWithRelations) => {
    setResources((currentResources) =>
      currentResources.map((resource) => (resource.id === updatedResource.id ? updatedResource : resource))
    )
  }

  const handleCreate = async (_newResource: ResourceWithRelations) => {
    await fetchResources()
  }

  const handleDelete = async (resourceId: number) => {
    if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
      return
    }

    try {
      const { error: topicsError } = await supabase
        .from('content_resource_topics')
        .delete()
        .eq('resource_id', resourceId)

      if (topicsError) {
        throw new Error('Failed to delete resource topics')
      }

      const { error: resourceError } = await supabase
        .from('content_resource')
        .delete()
        .eq('id', resourceId)

      if (resourceError) {
        throw new Error('Failed to delete resource')
      }

      setResources((currentResources) =>
        currentResources.filter((resource) => resource.id !== resourceId)
      )
      setCount((prevCount) => prevCount - 1)
    } catch (error) {
      console.error('Error deleting resource:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete resource')
    }
  }

  const handleBulkUpload = async () => {
    if (!csvFile) {
      setBulkError('Please choose a CSV file first.')
      return
    }

    try {
      setIsBulkUploading(true)
      setBulkError('')
      setBulkSummary(null)

      const content = await csvFile.text()
      const urls = extractUrlsFromCsv(content)

      if (urls.length === 0) {
        throw new Error('No valid URLs found in CSV.')
      }

      const response = await fetch('/api/resources/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Bulk upload failed')
      }

      setBulkSummary(data as BulkUploadSummary)
      setCsvFile(null)
      await fetchResources()
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Bulk upload failed')
    } finally {
      setIsBulkUploading(false)
    }
  }

  const totalPages = Math.ceil(count / RESOURCES_PER_PAGE)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Resources</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Resource
        </button>
      </div>

      <div className="mb-6 rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Bulk Upload Resource URLs (CSV)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          Upload a CSV containing resource URLs. Each URL will be scraped, summarized, categorized, and saved.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="block text-sm"
          />
          <button
            onClick={handleBulkUpload}
            disabled={isBulkUploading}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {isBulkUploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>
        {bulkError && <p className="mt-3 text-sm text-red-600">{bulkError}</p>}
        {bulkSummary && (
          <div className="mt-3 text-sm">
            <p>
              Processed {bulkSummary.total} URLs: {bulkSummary.created} created, {bulkSummary.existing} already
              existed, {bulkSummary.failed} failed.
            </p>
            {bulkSummary.failed > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {bulkSummary.results
                  .filter((result) => result.status === 'failed')
                  .slice(0, 10)
                  .map((result) => (
                    <li key={result.url}>
                      {result.url} - {result.error}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-lg dark:bg-gray-800 dark:border-gray-700 font-sans">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topics</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button
                  type="button"
                  onClick={handleDateSort}
                  className="inline-flex items-center gap-1 hover:text-gray-700"
                >
                  Published
                  <span className="normal-case text-[11px] text-gray-400">
                    {sortDirection === 'desc' ? '↓ Newest' : '↑ Oldest'}
                  </span>
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {resources.map((resource) => (
              <tr key={resource.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium dark:text-white">{resource.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                      {resource.description}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <a
                    href={resource.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Visit
                  </a>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {resource.resource_category?.name || '—'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {resource.content_resource_topics.map(({ content_topic }) => (
                      <span
                        key={content_topic.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      >
                        {content_topic.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {formatResourceDate(resource.date_published)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusClasses(resource.status)}`}>
                    {getStatusLabel(resource.status)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(resource)}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(resource.id)}
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {((currentPage - 1) * RESOURCES_PER_PAGE) + 1} to {Math.min(currentPage * RESOURCES_PER_PAGE, count)} of {count} results
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

      {selectedResource && (
        <EditResourceModal
          resource={selectedResource}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedResource(null)
          }}
          onUpdate={handleUpdate}
        />
      )}

      <EditResourceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
