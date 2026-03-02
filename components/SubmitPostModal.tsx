// components/SubmitPostModal.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit content</DialogTitle>
          <DialogDescription>
            Share an article with the UX Lift community.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="submit-content-url">URL</Label>
            <Input
              id="submit-content-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
            />
          </div>

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
