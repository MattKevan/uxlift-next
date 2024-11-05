'use client'

import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/catalyst/dialog'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
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

interface EditPostModalProps {
  post: PostWithRelations
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedPost: PostWithRelations) => void
}

export default function EditPostModal({ post, isOpen, onClose, onUpdate }: EditPostModalProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<Omit<Post, 'id'>>({
    content: post.content,
    date_created: post.date_created,
    date_published: post.date_published,
    description: post.description,
    image_path: post.image_path,
    indexed: post.indexed,
    link: post.link,
    site_id: post.site_id,
    status: post.status,
    summary: post.summary,
    tags_list: post.tags_list,
    title: post.title,
    user_id: post.user_id
  })
  const [selectedTopics, setSelectedTopics] = useState<number[]>(
    post.content_post_topics.map(pt => pt.content_topic.id)
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value))
    setSelectedTopics(selectedOptions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Start a transaction
      const { data: updatedPost, error: updateError } = await supabase
        .from('content_post')
        .update({
          ...formData
        })
        .eq('id', post.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Delete existing topic relationships
      const { error: deleteError } = await supabase
        .from('content_post_topics')
        .delete()
        .eq('post_id', post.id)

      if (deleteError) throw deleteError

      // Insert new topic relationships
      if (selectedTopics.length > 0) {
        const { error: insertError } = await supabase
          .from('content_post_topics')
          .insert(
            selectedTopics.map(topicId => ({
              post_id: post.id,
              topic_id: topicId
            }))
          )

        if (insertError) throw insertError
      }

      // Fetch the updated post with all relations
      const { data: finalPost, error: fetchError } = await supabase
        .from('content_post')
        .select(`
          *,
          content_site (*),
          content_post_topics (
            content_topic (*)
          )
        `)
        .eq('id', post.id)
        .single()

      if (fetchError) throw fetchError

      onUpdate(finalPost as PostWithRelations)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="max-w-2xl">
        <DialogTitle>Edit Post</DialogTitle>

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
                Summary
                <textarea
                  name="summary"
                  value={formData.summary}
                  onChange={handleChange}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Topics
                <select
                  multiple
                  value={selectedTopics.map(String)}
                  onChange={handleTopicChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  data-hs-select='{
                    "placeholder": "Select topics...",
                    "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
                    "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-gray-200 rounded-lg text-start text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400",
                    "dropdownClasses": "mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg overflow-hidden overflow-y-auto dark:bg-neutral-900 dark:border-neutral-700",
                    "optionClasses": "py-2 px-4 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg focus:outline-none focus:bg-gray-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-200"
                  }'
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
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
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
