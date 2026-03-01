'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import type { Database } from '@/types/supabase'
import EditToolModal from '@/components/EditToolModal'
import { format, isValid, parseISO } from 'date-fns'
import Link from 'next/link'
import { sanitizeToolTitle } from '@/utils/tool-tools/sanitize-tool-title'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

interface ToolImportItem {
  url: string
  description?: string
}

const TOOLS_PER_PAGE = 50
type SortField = 'date'
type SortDirection = 'asc' | 'desc'
type DestinationType = 'post' | 'resource'

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1
      }

      row.push(cell)
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row)
      }

      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((value) => value.trim().length > 0)) {
    rows.push(row)
  }

  return rows
}

function extractToolImportItemsFromCsv(content: string): ToolImportItem[] {
  const rows = parseCsvRows(content)
  if (rows.length === 0) return []

  const headerRow = rows[0].map((value) => value.trim().toLowerCase())
  const hasHeader = headerRow.includes('url')
  const urlIndex = headerRow.indexOf('url')
  const descriptionIndex = headerRow.indexOf('description')

  const dataRows = hasHeader ? rows.slice(1) : rows
  const items: ToolImportItem[] = []

  for (const row of dataRows) {
    let rawUrl = ''
    if (urlIndex >= 0) {
      rawUrl = row[urlIndex] || ''
    } else {
      rawUrl = row.find((value) => /^https?:\/\//i.test(value.trim())) || ''
    }

    const url = rawUrl.trim().replace(/[)\];]+$/, '')
    if (!url) continue

    const description =
      descriptionIndex >= 0
        ? (row[descriptionIndex] || '').trim()
        : ''

    items.push({
      url,
      description: description || undefined,
    })
  }

  const deduped = new Map<string, ToolImportItem>()
  for (const item of items) {
    const key = item.url.toLowerCase()
    if (!deduped.has(key)) {
      deduped.set(key, item)
    }
  }

  return Array.from(deduped.values())
}

function getStatusLabel(status: string) {
  if (status === 'P' || status === 'published') return 'Published'
  if (status === 'D' || status === 'draft') return 'Draft'
  return status
}

function isPublishedStatus(status: string) {
  return status === 'P' || status === 'published'
}

function getStatusClasses(status: string) {
  if (isPublishedStatus(status)) {
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
  const [reprocessingToolId, setReprocessingToolId] = useState<number | null>(null)
  const [togglingStatusToolId, setTogglingStatusToolId] = useState<number | null>(null)
  const [changeTypeTool, setChangeTypeTool] = useState<ToolWithRelations | null>(null)
  const [isChangeTypeModalOpen, setIsChangeTypeModalOpen] = useState(false)
  const [destinationType, setDestinationType] = useState<DestinationType>('post')
  const [isChangingType, setIsChangingType] = useState(false)
  const [changeTypeError, setChangeTypeError] = useState('')

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

  const handleTogglePublish = async (tool: ToolWithRelations) => {
    const nextStatus = isPublishedStatus(tool.status) ? 'draft' : 'published'

    try {
      setTogglingStatusToolId(tool.id)

      const { error } = await supabase
        .from('content_tool')
        .update({ status: nextStatus })
        .eq('id', tool.id)

      if (error) {
        throw new Error(error.message || 'Failed to update tool status')
      }

      setTools((currentTools) =>
        currentTools.map((currentTool) =>
          currentTool.id === tool.id
            ? { ...currentTool, status: nextStatus }
            : currentTool
        )
      )
    } catch (error) {
      console.error('Error updating tool status:', error)
      alert(error instanceof Error ? error.message : 'Failed to update tool status')
    } finally {
      setTogglingStatusToolId(null)
    }
  }

  const handleReprocess = async (toolId: number) => {
    try {
      setReprocessingToolId(toolId)

      const response = await fetch('/api/tools/reprocess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toolId }),
      })

      const responseText = await response.text()
      let data: {
        error?: string
        queued?: boolean
      } = {}

      if (responseText) {
        try {
          data = JSON.parse(responseText) as typeof data
        } catch {
          data = {}
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error || responseText || `Failed to reprocess tool (HTTP ${response.status})`
        )
      }

      if (data.queued) {
        alert('Tool reprocess queued in GitHub Actions. Refresh in a minute to see updates.')
        return
      }

      await fetchTools()
    } catch (error) {
      console.error('Error reprocessing tool:', error)
      alert(error instanceof Error ? error.message : 'Failed to reprocess tool')
    } finally {
      setReprocessingToolId(null)
    }
  }

  const openChangeTypeModal = (tool: ToolWithRelations) => {
    setChangeTypeTool(tool)
    setDestinationType('post')
    setChangeTypeError('')
    setIsChangeTypeModalOpen(true)
  }

  const closeChangeTypeModal = () => {
    setIsChangeTypeModalOpen(false)
    setChangeTypeTool(null)
    setChangeTypeError('')
    setDestinationType('post')
  }

  const handleChangeType = async () => {
    if (!changeTypeTool) return

    try {
      setIsChangingType(true)
      setChangeTypeError('')

      const response = await fetch('/api/tools/change-type', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId: changeTypeTool.id,
          destinationType,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to change content type')
      }

      closeChangeTypeModal()
      await fetchTools()
    } catch (error) {
      setChangeTypeError(error instanceof Error ? error.message : 'Failed to change content type')
    } finally {
      setIsChangingType(false)
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
      const items = extractToolImportItemsFromCsv(content)

      if (items.length === 0) {
        throw new Error('No valid URLs found in CSV.')
      }

      const response = await fetch('/api/tools/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
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
          Upload a CSV containing a `url` column and optional `description` column. Existing URLs will be skipped.
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
                    <Link
                      href={`/tools/${tool.slug}`}
                      target="_blank"
                      className="font-medium dark:text-white text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {sanitizeToolTitle(tool.title, tool.title)}
                    </Link>
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
                      onClick={() => handleTogglePublish(tool)}
                      disabled={togglingStatusToolId === tool.id}
                      className="text-emerald-600 hover:underline disabled:opacity-50 disabled:no-underline dark:text-emerald-400"
                    >
                      {togglingStatusToolId === tool.id
                        ? 'Saving...'
                        : isPublishedStatus(tool.status)
                          ? 'Unpublish'
                          : 'Publish'}
                    </button>
                    <button
                      onClick={() => handleReprocess(tool.id)}
                      disabled={reprocessingToolId === tool.id}
                      className="text-indigo-600 hover:underline disabled:opacity-50 disabled:no-underline dark:text-indigo-400"
                    >
                      {reprocessingToolId === tool.id ? 'Reprocessing...' : 'Reprocess'}
                    </button>
                    <button
                      onClick={() => handleEdit(tool)}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openChangeTypeModal(tool)}
                      disabled={isChangingType && changeTypeTool?.id === tool.id}
                      className="text-amber-600 hover:underline disabled:opacity-50 disabled:no-underline dark:text-amber-400"
                    >
                      {isChangingType && changeTypeTool?.id === tool.id ? 'Converting...' : 'Change type'}
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

      <Dialog open={isChangeTypeModalOpen} onOpenChange={(open) => !open && closeChangeTypeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Tool Type</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Move <span className="font-medium">{changeTypeTool?.title || 'this tool'}</span> to another content type.
              This removes it from Tools after conversion.
            </p>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Destination type
              <select
                value={destinationType}
                onChange={(event) => setDestinationType(event.target.value as DestinationType)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="post">Post</option>
                <option value="resource">Resource</option>
              </select>
            </label>

            {changeTypeError && (
              <p className="text-sm text-red-600 dark:text-red-400">{changeTypeError}</p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={closeChangeTypeModal}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleChangeType}
              disabled={!changeTypeTool || isChangingType}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isChangingType ? 'Converting...' : 'Convert'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
