'use client'

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Resource = Database['public']['Tables']['content_resource']['Row']
type Topic = Database['public']['Tables']['content_topic']['Row']
type ResourceCategory = Database['public']['Tables']['content_resource_category']['Row']

type ResourceWithRelations = Resource & {
  resource_category: ResourceCategory | null
  content_resource_topics: {
    content_topic: Topic
  }[]
}

interface EditResourceModalProps {
  resource?: ResourceWithRelations | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (updatedResource: ResourceWithRelations) => void
  onCreate?: (newResource: ResourceWithRelations) => void
}

function normalizeResourceStatus(status: string | null | undefined): string {
  if (!status) return 'draft'
  if (status === 'P') return 'published'
  if (status === 'D') return 'draft'
  if (status === 'published' || status === 'draft' || status === 'archived') return status
  return 'draft'
}

function createInitialFormData(resource?: ResourceWithRelations | null): Omit<Resource, 'id'> {
  if (resource) {
    return {
      title: resource.title,
      description: resource.description,
      summary: resource.summary,
      body: resource.body,
      link: resource.link,
      image_path: resource.image_path,
      status: normalizeResourceStatus(resource.status),
      date_created: resource.date_created,
      date_published: resource.date_published,
      slug: resource.slug,
      user_id: resource.user_id,
      resource_category_id: resource.resource_category_id,
    }
  }

  return {
    title: '',
    description: '',
    summary: '',
    body: null,
    link: '',
    image_path: null,
    status: 'draft',
    date_created: new Date().toISOString(),
    date_published: new Date().toISOString(),
    slug: '',
    user_id: null,
    resource_category_id: null,
  }
}

export default function EditResourceModal({
  resource,
  isOpen,
  onClose,
  onUpdate,
  onCreate,
}: EditResourceModalProps) {
  const supabase = createClient()
  const isCreateMode = !resource
  const [formData, setFormData] = useState<Omit<Resource, 'id'>>(createInitialFormData(resource))
  const [selectedTopics, setSelectedTopics] = useState<number[]>(
    resource?.content_resource_topics.map((item) => item.content_topic.id) || []
  )
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([])
  const [availableCategories, setAvailableCategories] = useState<ResourceCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    setFormData(createInitialFormData(resource))
    setSelectedTopics(resource?.content_resource_topics.map((item) => item.content_topic.id) || [])
    setError('')
  }, [isOpen, resource])

  useEffect(() => {
    if (!isOpen) return

    const fetchOptions = async () => {
      const [{ data: topics }, { data: categories }] = await Promise.all([
        supabase.from('content_topic').select('*').order('name'),
        supabase.from('content_resource_category').select('*').order('sort_order', { ascending: true }),
      ])

      if (topics) setAvailableTopics(topics)
      if (categories) setAvailableCategories(categories)
    }

    fetchOptions()
  }, [isOpen, supabase])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target

    if (name === 'date_published') {
      setFormData((prev) => ({
        ...prev,
        date_published: value ? new Date(value).toISOString() : null,
      }))
      return
    }

    if (name === 'resource_category_id') {
      setFormData((prev) => ({
        ...prev,
        resource_category_id: value ? parseInt(value, 10) : null,
      }))
      return
    }

    if (name === 'image_path') {
      setFormData((prev) => ({
        ...prev,
        image_path: value || null,
      }))
      return
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map((option) => parseInt(option.value, 10))
    setSelectedTopics(selectedOptions)
  }

  const handleCreate = async () => {
    const response = await fetch('/api/resources/create', {
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
      throw new Error(data.error || 'Failed to create resource')
    }

    if (data.resource && onCreate) {
      onCreate(data.resource as ResourceWithRelations)
    }
  }

  const handleUpdateSubmit = async () => {
    if (!resource) return

    const { error: updateError } = await supabase
      .from('content_resource')
      .update({
        ...formData,
      })
      .eq('id', resource.id)

    if (updateError) throw updateError

    const { error: deleteError } = await supabase
      .from('content_resource_topics')
      .delete()
      .eq('resource_id', resource.id)

    if (deleteError) throw deleteError

    if (selectedTopics.length > 0) {
      const topicRelations = selectedTopics.map((topicId) => ({
        resource_id: resource.id,
        topic_id: topicId,
      }))

      const { error: insertError } = await supabase
        .from('content_resource_topics')
        .insert(topicRelations)

      if (insertError) throw insertError
    }

    const { data: finalResource, error: fetchError } = await supabase
      .from('content_resource')
      .select(`
        *,
        resource_category:content_resource_category (*),
        content_resource_topics (
          content_topic:content_topic (*)
        )
      `)
      .eq('id', resource.id)
      .single()

    if (fetchError) throw fetchError

    if (finalResource && onUpdate) {
      onUpdate(finalResource as ResourceWithRelations)
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

  const dateValue = formData.date_published
    ? new Date(formData.date_published).toISOString().split('T')[0]
    : ''

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreateMode ? 'Create Resource' : 'Edit Resource'}</DialogTitle>
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
                Metadata, body content, summary, topics, and category are scraped automatically from this URL.
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
                <option value="archived">Archived</option>
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
                  Summary
                  <textarea
                    name="summary"
                    value={formData.summary}
                    onChange={handleChange}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Body (Markdown)
                  <textarea
                    name="body"
                    value={formData.body || ''}
                    onChange={handleChange}
                    rows={8}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Image URL / Path
                  <input
                    type="text"
                    name="image_path"
                    value={formData.image_path || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Published date
                  <input
                    type="date"
                    name="date_published"
                    value={dateValue}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Resource category
                  <select
                    name="resource_category_id"
                    value={formData.resource_category_id || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <option value="">Uncategorized</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Topics
                  <select
                    multiple
                    value={selectedTopics.map(String)}
                    onChange={handleTopicChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 min-h-32 dark:border-gray-700 dark:bg-gray-800"
                  >
                    {availableTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <DialogFooter>
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
              {isLoading ? 'Saving...' : isCreateMode ? 'Create Resource' : 'Save Changes'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
