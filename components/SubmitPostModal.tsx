// components/SubmitPostModal.tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/catalyst/dialog'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/NotificationContext'
import type { Database } from '@/types/supabase'

type Post = Database['public']['Tables']['content_post']['Row']

interface SubmitPostModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (post: Post) => void
}

export default function SubmitPostModal({ isOpen, onClose, onSuccess }: SubmitPostModalProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { addNotification } = useNotification()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: url.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to fetch URL')
      }

      setUrl('')
      if (onSuccess && data.post) {
        onSuccess(data.post as Post)
      }
      
      addNotification('success', 'Content submitted successfully!')
      onClose()

    } catch (error) {
      console.error('Error in form submission:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to submit content')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Submit content</DialogTitle>
      <DialogDescription>
        Share an article with the UX Lift community.
      </DialogDescription>
      
      <DialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <DialogActions>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Submit'}
            </Button>
          </DialogActions>
        </form>
      </DialogBody>
    </Dialog>
  )
}
