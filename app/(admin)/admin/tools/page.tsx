'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import type { Database } from '@/types/supabase'
import EditToolModal from '@/components/EditToolModal'
import { format, isValid, parseISO } from 'date-fns'

type Tool = Database['public']['Tables']['content_tool']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type ToolWithRelations = Tool & {
  content_tool_topics: {
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
    toolId?: number
    title?: string
    error?: string
  }>
}

const TOOLS_PER_PAGE = 50
type SortField = 'date'
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
  return status
}

function getStatusClasses(status: string) {
  if (status === 'P' || status === 'published') {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }
  if (status === 'D' || status === 'draft') {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
}

function formatToolDate(dateString: string | null | undefined) {
  if (!dateString) return '—'

  try {
    const parsedDate = parseISO(dateString)
    if (!isValid(parsedDate)) return '—'
    return format(parsedDate, 'dd/MM/yyyy')
  } catch {
    return '—'
  }
}

export default function AdminTools() {
  const [tools, setTools] = useState<ToolWithRelations[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const supabase = createClient()
  const [selectedTool, setSelectedTool] = useState<ToolWithRelations | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isBulkUploading, setIsBulkUploading] = useState(false)
  const [bulkSummary, setBulkSummary] = useState<BulkUploadSummary | null>(null)
  const [bulkError, setBulkError] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const fetchTools = async () => {
    let query = supabase
      .from('content_tool')
      .select(`
        *,
        content_tool_topics (
          content_topic (
            id,
            name,
            slug
          )
        )
      `, { count: 'exact' })

    if (sortField === 'date') {
      query = query.order('date', {
        ascending: sortDirection === 'asc',
        nullsFirst: false,
      })
    }

    const { data: toolsData, count: totalCount } = await query
      .order('id', { ascending: false })
      .range((currentPage - 1) * TOOLS_PER_PAGE, currentPage * TOOLS_PER_PAGE - 1)

    if (toolsData) {
      setTools(toolsData as ToolWithRelations[])
    }
    if (totalCount !== null) {
      setCount(totalCount)
    }
  }

  useEffect(() => {
    fetchTools()
  }, [currentPage, sortField, sortDirection])

  const handleDateSort = () => {
    if (sortField !== 'date') {
      setSortField('date')
      setSortDirection('desc')
      return
    }

    setSortDirection((currentDirection) => (
      currentDirection === 'desc' ? 'asc' : 'desc'
    ))
  }

  const handleEdit = (tool: ToolWithRelations) => {
    setSelectedTool(tool)
    setIsEditModalOpen(true)
  }

  const handleUpdate = (updatedTool: ToolWithRelations) => {
    setTools((currentTools) =>
      currentTools.map((tool) =>
        tool.id === updatedTool.id ? updatedTool : tool
      )
    )
  }

  const handleCreate = async (_newTool: ToolWithRelations) => {
    await fetchTools()
  }

  const handleDelete = async (toolId: number) => {
    if (!confirm('Are you sure you want to delete this tool? This action cannot be undone.')) {
      return
    }

    try {
      const { error: topicsError } = await supabase
        .from('content_tool_topics')
        .delete()
        .eq('tool_id', toolId)

      if (topicsError) {
        throw new Error('Failed to delete tool topics')
      }

      const { error: toolError } = await supabase
        .from('content_tool')
        .delete()
        .eq('id', toolId)

      if (toolError) {
        throw new Error('Failed to delete tool')
      }

      setTools((currentTools) =>
        currentTools.filter((tool) => tool.id !== toolId)
      )
      setCount((prevCount) => prevCount - 1)
    } catch (error) {
      console.error('Error deleting tool:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete tool')
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

      const response = await fetch('/api/tools/bulk-create', {
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
      await fetchTools()
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Bulk upload failed')
    } finally {
      setIsBulkUploading(false)
    }
  }

  const totalPages = Math.ceil(count / TOOLS_PER_PAGE)

  return (
    <div className="">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Tools</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Tool
        </button>
      </div>

      <div className="mb-6 rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Bulk Upload Tool URLs (CSV)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          Upload a CSV containing tool URLs. Each URL will be scraped, tagged, and saved.
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
              Processed {bulkSummary.total} URLs: {bulkSummary.created} created, {bulkSummary.existing} already existed, {bulkSummary.failed} failed.
            </p>
            {bulkSummary.failed > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {bulkSummary.results
                  .filter((result) => result.status === 'failed')
                  .slice(0, 10)
                  .map((result) => (
                    <li key={result.url}>{result.url} - {result.error}</li>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tool</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topics</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button
                  type="button"
                  onClick={handleDateSort}
                  className="inline-flex items-center gap-1 hover:text-gray-700"
                >
                  Date Added
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
            {tools.map((tool) => (
              <tr key={tool.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium dark:text-white">{tool.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                      {tool.description}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <a
                    href={tool.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Visit
                  </a>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {tool.content_tool_topics.map(({ content_topic }) => (
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
                    {formatToolDate(tool.date)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusClasses(tool.status)}`}>
                    {getStatusLabel(tool.status)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(tool)}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tool.id)}
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
          Showing {((currentPage - 1) * TOOLS_PER_PAGE) + 1} to {Math.min(currentPage * TOOLS_PER_PAGE, count)} of {count} results
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

      {selectedTool && (
        <EditToolModal
          tool={selectedTool}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedTool(null)
          }}
          onUpdate={handleUpdate}
        />
      )}

      <EditToolModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
