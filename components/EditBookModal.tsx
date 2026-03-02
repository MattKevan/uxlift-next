// /components/EditBookModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { CldUploadWidget } from 'next-cloudinary'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultipleSelector, Option } from '@/components/ui/multiple-selector'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Database } from '@/types/supabase'

type Book = Database['public']['Tables']['content_book']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type BookWithRelations = Book & {
  content_book_topics: {
    topic: Topic
  }[]
}

interface EditBookModalProps {
  book: BookWithRelations
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedBook: BookWithRelations) => void
}

function getCloudinaryImageUrl(imagePath: string | null | undefined) {
  if (!imagePath) return ''
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return ''

  return `https://res.cloudinary.com/${cloudName}/image/upload/${imagePath}`
}

export default function EditBookModal({ book, isOpen, onClose, onUpdate }: EditBookModalProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<Omit<Book, 'id'>>({
    title: book.title,
    description: book.description,
    image_path: book.image_path,
    link: book.link,
    date_created: book.date_created,
    date_published: book.date_published,
    free: book.free,
    status: book.status,
    authors: book.authors,
    publisher: book.publisher,
    summary: book.summary,
    body: book.body,
  })

  const [selectedTopics, setSelectedTopics] = useState<Option[]>(
    book.content_book_topics.map((bt) => ({
      value: String(bt.topic.id),
      label: bt.topic.name,
    }))
  )
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadedImage, setUploadedImage] = useState<{
    public_id: string
    secure_url: string
  } | null>(null)

  useEffect(() => {
    const fetchTopics = async () => {
      const { data: topics } = await supabase
        .from('content_topic')
        .select('*')
        .order('name')

      if (topics) {
        setAvailableTopics(topics)
      }
    }

    fetchTopics()
  }, [supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    if (name === 'date_created' || name === 'date_published') {
      setFormData((prev) => ({
        ...prev,
        [name]: value ? new Date(value).toISOString() : null,
      }))
      return
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleImageUploadSuccess = (result: any) => {
    const imageInfo = result.info
    setUploadedImage({
      public_id: imageInfo.public_id,
      secure_url: imageInfo.secure_url,
    })
    setFormData((prev) => ({
      ...prev,
      image_path: imageInfo.public_id,
    }))
  }

  const handleTopicChange = (options: Option[]) => {
    setSelectedTopics(options)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('content_book')
        .update({
          ...formData,
        })
        .eq('id', book.id)

      if (updateError) throw updateError

      const { error: deleteError } = await supabase
        .from('content_book_topics')
        .delete()
        .eq('book_id', book.id)

      if (deleteError) throw deleteError

      if (selectedTopics.length > 0) {
        const { error: insertError } = await supabase
          .from('content_book_topics')
          .insert(
            selectedTopics.map((topic) => ({
              book_id: book.id,
              topic_id: parseInt(topic.value, 10),
            }))
          )

        if (insertError) throw insertError
      }

      const { data: finalBook, error: fetchError } = await supabase
        .from('content_book')
        .select(`
          *,
          content_book_topics (
            topic:topic_id (*)
          )
        `)
        .eq('id', book.id)
        .single()

      if (fetchError) throw fetchError

      onUpdate(finalBook as BookWithRelations)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const imagePreviewUrl = uploadedImage?.secure_url || getCloudinaryImageUrl(formData.image_path)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Book</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="book-title">Title</Label>
            <Input
              id="book-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="book-description">Description</Label>
            <Textarea
              id="book-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="book-authors">Authors</Label>
            <Input
              id="book-authors"
              type="text"
              name="authors"
              value={formData.authors}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="book-publisher">Publisher</Label>
            <Input
              id="book-publisher"
              type="text"
              name="publisher"
              value={formData.publisher}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="book-link">Link</Label>
            <Input
              id="book-link"
              type="url"
              name="link"
              value={formData.link}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Book Cover Image</Label>

            <div className="flex items-start space-x-4">
              <div className="w-32 h-48 relative border rounded overflow-hidden">
                {imagePreviewUrl && (
                  <img
                    src={imagePreviewUrl}
                    alt="Book cover"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex flex-col space-y-2">
                <CldUploadWidget
                  uploadPreset="Standard"
                  onSuccess={(result: any, { widget }) => {
                    handleImageUploadSuccess(result)
                    widget.close()
                  }}
                >
                  {({ open }) => (
                    <Button type="button" variant="outline" onClick={() => open?.()}>
                      {formData.image_path ? 'Change Image' : 'Upload Image'}
                    </Button>
                  )}
                </CldUploadWidget>

                {formData.image_path && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, image_path: null }))
                      setUploadedImage(null)
                    }}
                  >
                    Remove Image
                  </Button>
                )}

                {formData.image_path && (
                  <div className="text-xs text-muted-foreground break-all">
                    Image ID: {formData.image_path}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="book-date-created">Date Created</Label>
              <Input
                id="book-date-created"
                type="date"
                name="date_created"
                value={formData.date_created ? new Date(formData.date_created).toISOString().split('T')[0] : ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="book-date-published">Date Published</Label>
              <Input
                id="book-date-published"
                type="date"
                name="date_published"
                value={formData.date_published ? new Date(formData.date_published).toISOString().split('T')[0] : ''}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Topics</Label>
            <MultipleSelector
              value={selectedTopics}
              onChange={handleTopicChange}
              options={availableTopics.map((topic) => ({
                value: String(topic.id),
                label: topic.name,
              }))}
              placeholder="Select topics..."
              emptyIndicator={<p className="text-center text-sm text-muted-foreground">No topics found</p>}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="book-status">Status</Label>
            <Select
              id="book-status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="book-body">Body Content</Label>
            <Textarea
              id="book-body"
              name="body"
              value={formData.body || ''}
              onChange={handleChange}
              rows={10}
              className="font-mono"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="book-free"
              checked={!!formData.free}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  free: checked === true,
                }))
              }
            />
            <Label htmlFor="book-free">Free Book</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
