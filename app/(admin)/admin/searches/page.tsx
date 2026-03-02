'use client'

import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AdminSearchItem, AdminSearchesResponse } from '@/types/admin-searches'

const SEARCHES_PER_PAGE = 50

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function getResponseSnippet(search: AdminSearchItem) {
  const fullText = search.summary || search.resultPayload?.answer || search.resultPayload?.error || ''
  if (!fullText) return 'No response saved'
  return fullText.length > 140 ? `${fullText.slice(0, 140)}...` : fullText
}

export default function AdminSearches() {
  const [searches, setSearches] = useState<AdminSearchItem[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedSearch, setSelectedSearch] = useState<AdminSearchItem | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / SEARCHES_PER_PAGE)), [count])

  const fetchSearches = async (page = currentPage) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/searches?page=${page}&perPage=${SEARCHES_PER_PAGE}`, {
        cache: 'no-store',
      })
      const result = await response.json() as AdminSearchesResponse | { error?: string }

      if (!response.ok) {
        throw new Error('error' in result ? result.error : 'Failed to fetch searches')
      }

      const parsed = result as AdminSearchesResponse
      setSearches(parsed.searches)
      setCount(parsed.total)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch searches')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSearches(currentPage)
  }, [currentPage])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Searches</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full rounded-lg border bg-white font-sans dark:border-gray-700 dark:bg-gray-800">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Query</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Response Snippet</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {searches.map((search) => (
              <tr key={search.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 text-sm font-medium dark:text-white">{search.query}</td>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{getResponseSnippet(search)}</td>
                <td className="px-6 py-4 text-sm">{search.userEmail || 'Anonymous'}</td>
                <td className="px-6 py-4 text-sm">{formatDate(search.createdAt)}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setSelectedSearch(search)}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && searches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-500">
                  No searches found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-500">
                  Loading searches...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {count === 0 ? 0 : (currentPage - 1) * SEARCHES_PER_PAGE + 1} to{' '}
          {Math.min(currentPage * SEARCHES_PER_PAGE, count)} of {count} searches
        </div>
        <div className="flex space-x-2">
          {currentPage > 1 && (
            <button
              onClick={() => setCurrentPage((page) => page - 1)}
              className="rounded border px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Previous
            </button>
          )}
          {currentPage < totalPages && (
            <button
              onClick={() => setCurrentPage((page) => page + 1)}
              className="rounded border px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Next
            </button>
          )}
        </div>
      </div>

      <Dialog open={Boolean(selectedSearch)} onOpenChange={(open) => !open && setSelectedSearch(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedSearch && (
            <>
              <DialogHeader>
                <DialogTitle>Search Details</DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Query</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedSearch.query}</p>
                </div>

                <div className="grid gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <p><span className="font-medium">User:</span> {selectedSearch.userEmail || 'Anonymous'}</p>
                  <p><span className="font-medium">Date:</span> {formatDate(selectedSearch.createdAt)}</p>
                  <p><span className="font-medium">Results:</span> {selectedSearch.totalResults ?? 0}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Full Response</p>
                  <div className="prose max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedSearch.summary || selectedSearch.resultPayload?.answer || selectedSearch.resultPayload?.error || 'No response saved'}
                    </ReactMarkdown>
                  </div>
                </div>

                {selectedSearch.resultPayload?.results && selectedSearch.resultPayload.results.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Matched Results</p>
                    <div className="space-y-3">
                      {selectedSearch.resultPayload.results.map((result) => (
                        <div key={`${result.post_id}-${result.link}`} className="rounded border p-3 text-sm">
                          <a
                            href={result.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {result.title}
                          </a>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            Similarity: {result.similarity.toFixed(3)}
                          </p>
                          <p className="mt-2 text-gray-700 dark:text-gray-300">{result.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
