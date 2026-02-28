'use client'

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'
import { CldUploadWidget } from 'next-cloudinary'

type Tool = Database['public']['Tables']['content_tool']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type ToolWithRelations = Tool & {
  content_tool_topics: {
    content_topic: Topic
  }[]
}

interface EditToolModalProps {
  tool?: ToolWithRelations | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (updatedTool: ToolWithRelations) => void
  onCreate?: (newTool: ToolWithRelations) => void
}

function normalizeToolStatus(status: string | null | undefined): string {
  if (!status) return 'draft'
  if (status === 'P') return 'published'
  if (status === 'D') return 'draft'
  if (status === 'published' || status === 'draft') return status
  return 'draft'
}

function createInitialFormData(tool?: ToolWithRelations | null): Omit<Tool, 'id'> {
  if (tool) {
    return {
      title: tool.title,
      description: tool.description,
      body: tool.body,
      link: tool.link,
      image: tool.image,
      status: normalizeToolStatus(tool.status),
      date: tool.date,
      slug: tool.slug,
      user_id: tool.user_id,
    }
  }

  return {
    title: '',
    description: '',
    body: null,
    link: '',
    image: '',
    status: 'draft',
    date: new Date().toISOString(),
    slug: '',
    user_id: null,
  }
}

function getImagePreviewUrl(image: string | null | undefined) {
  if (!image) return ''
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return ''

  return `https://res.cloudinary.com/${cloudName}/image/upload/${image}`
}

export default function EditToolModal({
  tool,
  isOpen,
  onClose,
  onUpdate,
  onCreate,
}: EditToolModalProps) {
  const supabase = createClient()
  const isCreateMode = !tool
  const [formData, setFormData] = useState<Omit<Tool, 'id'>>(createInitialFormData(tool))
  const [selectedTopics, setSelectedTopics] = useState<number[]>(
    tool?.content_tool_topics.map((tt) => tt.content_topic.id) || []
  )
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadedImage, setUploadedImage] = useState<{
    public_id: string
    secure_url: string
  } | null>(null)

  useEffect(() => {
    if (!isOpen) return

    setFormData(createInitialFormData(tool))
    setSelectedTopics(tool?.content_tool_topics.map((tt) => tt.content_topic.id) || [])
    setUploadedImage(null)
    setError('')
  }, [isOpen, tool])

  useEffect(() => {
    if (isCreateMode) return

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
  }, [isCreateMode, supabase])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    if (name === 'date') {
      setFormData((prev) => ({
        ...prev,
        [name]: value ? new Date(value).toISOString() : new Date().toISOString(),
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
      image: imageInfo.public_id,
    }))
  }

  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map((option) => parseInt(option.value, 10))
    setSelectedTopics(selectedOptions)
  }

  const handleCreate = async () => {
    const response = await fetch('/api/tools/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formData.link.trim(),
        status: formData.status,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create tool')
    }

    if (data.tool && onCreate) {
      onCreate(data.tool as ToolWithRelations)
    }
  }

  const handleUpdateSubmit = async () => {
    if (!tool) return

    const { error: updateError } = await supabase
      .from('content_tool')
      .update({
        ...formData,
      })
      .eq('id', tool.id)

    if (updateError) throw updateError

    const { error: deleteError } = await supabase
      .from('content_tool_topics')
      .delete()
      .eq('tool_id', tool.id)

    if (deleteError) throw deleteError

    if (selectedTopics.length > 0) {
      const topicRelations = selectedTopics.map((topicId) => ({
        id: Math.floor(Math.random() * 1_000_000_000),
        tool_id: tool.id,
        topic_id: topicId,
      }))

      const { error: insertError } = await supabase
        .from('content_tool_topics')
        .insert(topicRelations)

      if (insertError) throw insertError
    }

    const { data: finalTool, error: fetchError } = await supabase
      .from('content_tool')
      .select(`
        *,
        content_tool_topics (
          content_topic (*)
        )
      `)
      .eq('id', tool.id)
      .single()

    if (fetchError) throw fetchError

    if (finalTool && onUpdate) {
      onUpdate(finalTool as ToolWithRelations)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isCreateMode) {
        await handleCreate()
      } else {
        await handleUpdateSubmit()
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreateMode ? 'Create Tool' : 'Edit Tool'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                URL
                <input
                  type="url"
                  name="link"
                  value={formData.link}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  required
                />
              </label>
              {isCreateMode && (
                <p className="mt-1 text-sm text-gray-500">
                  Title, metadata, page content, logo, and topics are scraped automatically from this URL.
                </p>
              )}
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

            {!isCreateMode && (
              <>
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
                    Body
                    <textarea
                      name="body"
                      value={formData.body || ''}
                      onChange={handleChange}
                      rows={5}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Tool Image
                  </label>

                  <div className="flex items-start space-x-4">
                    <div className="w-32 h-32 relative border rounded overflow-hidden">
                      {(uploadedImage?.secure_url || formData.image) && (
                        <img
                          src={uploadedImage?.secure_url || getImagePreviewUrl(formData.image)}
                          alt="Tool image"
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
                          <button
                            type="button"
                            onClick={() => open()}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            {formData.image ? 'Change Image' : 'Upload Image'}
                          </button>
                        )}
                      </CldUploadWidget>

                      {formData.image && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, image: '' }))
                            setUploadedImage(null)
                          }}
                          className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 dark:bg-gray-800 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          Remove Image
                        </button>
                      )}
                    </div>
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
                      {availableTopics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-1 text-sm text-gray-500">Hold Ctrl/Cmd to select multiple topics</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Slug
                    <input
                      type="text"
                      name="slug"
                      value={formData.slug}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                      required
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Date
                    <input
                      type="date"
                      name="date"
                      value={formData.date?.split('T')[0] || ''}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                      required
                    />
                  </label>
                </div>
              </>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <DialogFooter className="pt-2">
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
                {isLoading
                  ? (isCreateMode ? 'Creating...' : 'Saving...')
                  : (isCreateMode ? 'Create Tool' : 'Save Changes')}
              </button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  )
}
