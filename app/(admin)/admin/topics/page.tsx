'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Topic = Database['public']['Tables']['content_topic']['Row']

const TOPICS_PER_PAGE = 50

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function createInitialForm() {
  return {
    name: '',
    slug: '',
    description: '',
  }
}

export default function AdminTopics() {
  const supabase = createClient()
  const [topics, setTopics] = useState<Topic[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [formData, setFormData] = useState(createInitialForm())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const totalPages = useMemo(() => Math.ceil(count / TOPICS_PER_PAGE), [count])

  const fetchTopics = async () => {
    const { data, count: totalCount, error: fetchError } = await supabase
      .from('content_topic')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range((currentPage - 1) * TOPICS_PER_PAGE, currentPage * TOPICS_PER_PAGE - 1)

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setTopics(data || [])
    setCount(totalCount || 0)
  }

  useEffect(() => {
    fetchTopics()
  }, [currentPage])

  const openCreateModal = () => {
    setEditingTopic(null)
    setFormData(createInitialForm())
    setError('')
    setIsModalOpen(true)
  }

  const openEditModal = (topic: Topic) => {
    setEditingTopic(topic)
    setFormData({
      name: topic.name,
      slug: topic.slug,
      description: topic.description || '',
    })
    setError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (isSaving) return
    setIsModalOpen(false)
    setEditingTopic(null)
    setFormData(createInitialForm())
    setError('')
  }

  const handleNameChange = (value: string) => {
    setFormData((current) => ({
      ...current,
      name: value,
      slug: editingTopic ? current.slug : slugify(value),
    }))
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    const payload: Database['public']['Tables']['content_topic']['Update'] = {
      name: formData.name.trim(),
      slug: slugify(formData.slug),
      description: formData.description.trim() || null,
    }

    try {
      if (!payload.name || !payload.slug) {
        throw new Error('Name and slug are required.')
      }

      if (editingTopic) {
        const { error: updateError } = await supabase
          .from('content_topic')
          .update(payload)
          .eq('id', editingTopic.id)

        if (updateError) throw updateError
      } else {
        let inserted = false
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const insertPayload: Database['public']['Tables']['content_topic']['Insert'] = {
            id: Math.floor(Math.random() * 1_000_000_000),
            name: payload.name,
            slug: payload.slug,
            description: payload.description || null,
          }

          const { error: insertError } = await supabase.from('content_topic').insert([insertPayload])
          if (!insertError) {
            inserted = true
            break
          }

          if (insertError.code !== '23505') {
            throw insertError
          }
        }

        if (!inserted) {
          throw new Error('Failed to create topic due to duplicate identifiers.')
        }
      }

      closeModal()
      await fetchTopics()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save topic')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (topicId: number) => {
    if (!confirm('Delete this topic? This may affect related content tagging.')) {
      return
    }

    try {
      const { error: deleteError } = await supabase
        .from('content_topic')
        .delete()
        .eq('id', topicId)

      if (deleteError) throw deleteError

      await fetchTopics()
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : 'Failed to delete topic')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Topics</h1>
        <button
          onClick={openCreateModal}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Topic
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full rounded-lg border bg-white font-sans dark:border-gray-700 dark:bg-gray-800">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Slug</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {topics.map((topic) => (
              <tr key={topic.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 font-medium dark:text-white">{topic.name}</td>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{topic.slug}</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{topic.description || '—'}</td>
                <td className="px-6 py-4">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => openEditModal(topic)}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(topic.id)}
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

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {count === 0 ? 0 : (currentPage - 1) * TOPICS_PER_PAGE + 1} to{' '}
          {Math.min(currentPage * TOPICS_PER_PAGE, count)} of {count} topics
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

      <Dialog open={isModalOpen} onOpenChange={(open) => (!open ? closeModal() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTopic ? 'Edit Topic' : 'Create Topic'}</DialogTitle>
            <DialogDescription>Manage topic metadata used for content tagging.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData((current) => ({ ...current, slug: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((current) => ({ ...current, description: e.target.value }))}
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingTopic ? 'Save Changes' : 'Create Topic'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
