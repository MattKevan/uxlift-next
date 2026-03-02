'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import type { Database } from '@/types/supabase'
import { MultipleSelector, Option } from '@/components/ui/multiple-selector'

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
    user_id: post.user_id,
    slug: post.slug,
  })
  const [selectedTopics, setSelectedTopics] = useState<Option[]>(
    post.content_post_topics.map((pt) => ({
      value: String(pt.content_topic.id),
      label: pt.content_topic.name,
    }))
  )
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTopics = async () => {
      const { data: topics } = await supabase.from('content_topic').select('*').order('name')

      if (topics) {
        setAvailableTopics(topics)
      }
    }

    fetchTopics()
  }, [supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
        .from('content_post')
        .update({
          ...formData,
        })
        .eq('id', post.id)

      if (updateError) throw updateError

      const { error: deleteError } = await supabase
        .from('content_post_topics')
        .delete()
        .eq('post_id', post.id)

      if (deleteError) throw deleteError

      if (selectedTopics.length > 0) {
        const { error: insertError } = await supabase.from('content_post_topics').insert(
          selectedTopics.map((topic) => ({
            post_id: post.id,
            topic_id: parseInt(topic.value, 10),
          }))
        )

        if (insertError) throw insertError
      }

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              type="text"
              name="title"
              value={formData.title ?? ''}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-description">Description</Label>
            <Textarea
              id="post-description"
              name="description"
              value={formData.description ?? ''}
              onChange={handleChange}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-summary">Summary</Label>
            <Textarea
              id="post-summary"
              name="summary"
              value={formData.summary ?? ''}
              onChange={handleChange}
              rows={2}
              required
            />
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
            <Label htmlFor="post-status">Status</Label>
            <Select id="post-status" name="status" value={formData.status ?? 'draft'} onChange={handleChange}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
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
