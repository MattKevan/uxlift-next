'use client'

import { useState } from 'react'
import type { Database } from '@/types/supabase'

type Post = Database['public']['Tables']['content_post']['Row']
type Site = Database['public']['Tables']['content_site']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type PostWithRelations = Post & {
  content_site: Site | null
  content_post_topics: {
    content_topic: Topic
  }[]
}

interface FetchUrlFormProps {
  onSuccess?: (post: PostWithRelations) => void
}

export default function FetchUrlForm({ onSuccess }: FetchUrlFormProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to fetch URL')
      }

      setUrl('')
      if (onSuccess && data.post) {
        onSuccess(data.post as PostWithRelations)
      }

    } catch (error) {
      console.error('Error in form submission:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans mb-12">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
            placeholder="https://example.com/article"
            required
          />
        </label>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Processing...' : 'Fetch URL'}
      </button>
    </form>
  )
}
