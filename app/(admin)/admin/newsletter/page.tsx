'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { Database } from '@/types/supabase'

type NewsletterPost = Database['public']['Tables']['newsletter_posts']['Row']

const POSTS_PER_PAGE = 50

export default function AdminNewsletter() {
  const [posts, setPosts] = useState<NewsletterPost[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [syncing, setSyncing] = useState(false)
  const supabase = createClient()

  const fetchPosts = async () => {
    const { data: postsData, count: totalCount } = await supabase
      .from('newsletter_posts')
      .select('*', { count: 'exact' })
      .order('publish_date', { ascending: false })
      .range((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE - 1)

    if (postsData) {
      setPosts(postsData)
    }
    if (totalCount !== null) {
      setCount(totalCount)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [currentPage])

  const handleSync = async () => {
    try {
      setSyncing(true)
      
      const response = await fetch('/api/sync-newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync newsletter posts')
      }

      alert(`Successfully synced ${result.imported} posts`)
      await fetchPosts() // Refresh the list
      
    } catch (error) {
      console.error('Error syncing newsletter posts:', error)
      alert(error instanceof Error ? error.message : 'Failed to sync newsletter posts')
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'dd/MM/yyyy HH:mm')
  }

  const totalPages = Math.ceil(count / POSTS_PER_PAGE)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Newsletter Posts</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors
            ${syncing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {syncing ? 'Syncing...' : 'Sync Posts'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-lg dark:bg-gray-800 dark:border-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                Audience
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                Published
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                Stats
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <a 
                      href={post.web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {post.title}
                    </a>
                    {post.subtitle && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {post.subtitle}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    post.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {post.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="capitalize">{post.audience}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(post.publish_date)}
                </td>
                <td className="px-6 py-4">
                  {post.stats && (
                    <div className="text-sm">
                      <div>Views: {(post.stats as any).web?.views || 0}</div>
                      <div>Opens: {(post.stats as any).email?.unique_opens || 0}</div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {((currentPage - 1) * POSTS_PER_PAGE) + 1} to {Math.min(currentPage * POSTS_PER_PAGE, count)} of {count} results
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
    </div>
  )
}
