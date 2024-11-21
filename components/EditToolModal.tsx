'use client'

import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/catalyst/dialog'
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
  tool: ToolWithRelations
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedTool: ToolWithRelations) => void
}

export default function EditToolModal({ tool, isOpen, onClose, onUpdate }: EditToolModalProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<Omit<Tool, 'id'>>({
    title: tool.title,
    description: tool.description,
    body: tool.body,
    link: tool.link,
    image: tool.image,
    status: tool.status,
    date: tool.date,
    slug: tool.slug,
    user_id: tool.user_id 
  })
  const [selectedTopics, setSelectedTopics] = useState<number[]>(
    tool.content_tool_topics.map(tt => tt.content_topic.id)
  )
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [uploadedImage, setUploadedImage] = useState<{
    public_id: string;
    secure_url: string;
  } | null>(null);

  // Update handleChange to handle checkbox
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
      }))
    } else if (name === 'date') {
      // Ensure we always have a valid date string, default to current date if empty
      setFormData(prev => ({
        ...prev,
        [name]: value ? new Date(value).toISOString() : new Date().toISOString()
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
      image: imageInfo.public_id // Save the public_id to the image field
    }));
  };


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


  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value))
    setSelectedTopics(selectedOptions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
  
    try {
      // Update tool
      const { data: updatedTool, error: updateError } = await supabase
        .from('content_tool')
        .update({
          ...formData
        })
        .eq('id', tool.id)
        .select()
        .single()
  
      if (updateError) throw updateError
  
      // Delete existing topic relationships
      const { error: deleteError } = await supabase
        .from('content_tool_topics')
        .delete()
        .eq('tool_id', tool.id)
  
      if (deleteError) throw deleteError
  
      // Insert new topic relationships
      if (selectedTopics.length > 0) {
        // Generate topic relationships with required id field
        const topicRelations = selectedTopics.map(topicId => ({
          id: Math.floor(Math.random() * 1000000), // Generate a unique ID
          tool_id: tool.id,
          topic_id: topicId
        }))
  
        const { error: insertError } = await supabase
          .from('content_tool_topics')
          .insert(topicRelations)
  
        if (insertError) throw insertError
      }
  
      // Fetch the updated tool with all relations
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
  
      onUpdate(finalTool as ToolWithRelations)
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
        <DialogTitle>Edit Tool</DialogTitle>

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
                Tool Image
              </label>
              
              <div className="flex items-start space-x-4">
                {/* Current/Uploaded Image Preview */}
                <div className="w-32 h-32 relative border rounded overflow-hidden">
                  {(uploadedImage?.secure_url || formData.image) && (
                    <img
                      src={uploadedImage?.secure_url || `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${formData.image}`}
                      alt="Tool image"
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
                        {formData.image ? 'Change Image' : 'Upload Image'}
                      </button>
                    )}
                  </CldUploadWidget>

                  {/* Remove Image Button */}
                  {formData.image && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, image: '' }));
                        setUploadedImage(null);
                      }}
                      className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 dark:bg-gray-800 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Remove Image
                    </button>
                  )}

                  {/* Current Image ID */}
                  {formData.image && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
                      Image ID: {formData.image}
                    </div>
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
                  {availableTopics.map(topic => (
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
                Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="P">Published</option>
                  <option value="D">Draft</option>
                </select>
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
                Date
                <input
                  type="date"
                  name="date"
                  value={formData.date.split('T')[0]} // Convert ISO date to YYYY-MM-DD
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  required
                />
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
