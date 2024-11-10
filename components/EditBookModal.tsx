// /components/EditBookModal.tsx
'use client'

import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/catalyst/dialog'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'
import { CldUploadWidget } from 'next-cloudinary'

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
    body: book.body  // Add this line
  })
  
  const [selectedTopics, setSelectedTopics] = useState<number[]>(
    book.content_book_topics.map(bt => bt.topic.id)
  )
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch available topics
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
  }, [])

  

  const [uploadedImage, setUploadedImage] = useState<{
    public_id: string;
    secure_url: string;
  } | null>(null);

  // Update handleChange to handle image path
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
      }))
    } else if (name === 'date_created' || name === 'date_published') {
      setFormData(prev => ({
        ...prev,
        [name]: value ? new Date(value).toISOString() : null
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  // Add image upload success handler
  const handleImageUploadSuccess = (result: any) => {
    const imageInfo = result.info;
    setUploadedImage({
      public_id: imageInfo.public_id,
      secure_url: imageInfo.secure_url
    });
    setFormData(prev => ({
      ...prev,
      image_path: imageInfo.public_id // Save the public_id to the image_path
    }));
  };
  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value))
    setSelectedTopics(selectedOptions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Update book
      const { data: updatedBook, error: updateError } = await supabase
        .from('content_book')
        .update({
          ...formData
        })
        .eq('id', book.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Delete existing topic relationships
      const { error: deleteError } = await supabase
        .from('content_book_topics')
        .delete()
        .eq('book_id', book.id)

      if (deleteError) throw deleteError

      // Insert new topic relationships
      if (selectedTopics.length > 0) {
        const { error: insertError } = await supabase
          .from('content_book_topics')
          .insert(
            selectedTopics.map(topicId => ({
              book_id: book.id,
              topic_id: topicId
            }))
          )

        if (insertError) throw insertError
      }

      // Fetch the updated book with all relations
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

  return (
    <Dialog open={isOpen} onClose={onClose} size='5xl'>
      <div className="max-w-5xl">
        <DialogTitle>Edit Book</DialogTitle>

        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Title
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Description
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Authors
                <input
                  type="text"
                  name="authors"
                  value={formData.authors}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Publisher
                <input
                  type="text"
                  name="publisher"
                  value={formData.publisher}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Link
                <input
                  type="url"
                  name="link"
                  value={formData.link}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  required
                />
              </label>
            </div>

            <div className="space-y-2">
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
      Book Cover Image
    </label>
    
    <div className="flex items-start space-x-4">
      {/* Current/Uploaded Image Preview */}
      <div className="w-32 h-48 relative border rounded overflow-hidden">
        {(uploadedImage?.secure_url || formData.image_path) && (
          <img
            src={uploadedImage?.secure_url || `https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/${formData.image_path}`}
            alt="Book cover"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-col space-y-2">
        {/* Upload Widget */}
        <CldUploadWidget
          uploadPreset="Standard"
          onSuccess={(result: any, { widget }) => {
            handleImageUploadSuccess(result);
            widget.close();
          }}
        >
          {({ open }) => (
            <button
              type="button"
              onClick={() => open()}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {formData.image_path ? 'Change Image' : 'Upload Image'}
            </button>
          )}
        </CldUploadWidget>

        {/* Remove Image Button */}
        {formData.image_path && (
          <button
            type="button"
            onClick={() => {
              setFormData(prev => ({ ...prev, image_path: null }));
              setUploadedImage(null);
            }}
            className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 dark:bg-gray-800 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Remove Image
          </button>
        )}

        {/* Current Image ID */}
        {formData.image_path && (
          <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
            Image ID: {formData.image_path}
          </div>
        )}
      </div>
    </div>
  </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Date Created
                  <input
                    type="date"
                    name="date_created"
                    value={formData.date_created ? new Date(formData.date_created).toISOString().split('T')[0] : ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Date Published
                  <input
                    type="date"
                    name="date_published"
                    value={formData.date_published ? new Date(formData.date_published).toISOString().split('T')[0] : ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Topics
                <select
                  multiple
                  value={selectedTopics.map(String)}
                  onChange={handleTopicChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                >
                  {availableTopics.map(topic => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </label>
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Body Content
                <textarea
                name="body"
                value={formData.body || ''}
                onChange={handleChange}
                rows={10}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-800"
                />
            </label>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  name="free"
                  checked={formData.free}
                  onChange={handleChange}
                  className="mr-2 rounded border-gray-300 dark:border-gray-700"
                />
                Free Book
              </label>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <DialogActions>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </DialogActions>
          </form>
        </DialogBody>
      </div>
    </Dialog>
  )
}
