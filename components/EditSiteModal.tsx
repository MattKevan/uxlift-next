'use client'

import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/catalyst/dialog'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Site = Database['public']['Tables']['content_site']['Row']
type SiteType = Database['public']['Tables']['content_sitetype']['Row']
type SiteWithRelations = Site & {
  content_site_site_type: {
    content_sitetype: SiteType
  }[]
}

interface EditSiteModalProps {
  site: SiteWithRelations
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedSite: SiteWithRelations) => void
}

export default function EditSiteModal({ site, isOpen, onClose, onUpdate }: EditSiteModalProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<Omit<Site, 'id'>>({
    title: site.title,
    description: site.description,
    url: site.url,
    feed_url: site.feed_url,
    content: site.content,
    site_icon: site.site_icon,
    slug: site.slug,
    status: site.status,
    include_in_newsfeed: site.include_in_newsfeed,
  })
  const [selectedSiteTypes, setSelectedSiteTypes] = useState<number[]>(
    site.content_site_site_type.map(st => st.content_sitetype.id)
  )
  const [availableSiteTypes, setAvailableSiteTypes] = useState<SiteType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch available site types
  useEffect(() => {
    const fetchSiteTypes = async () => {
      const { data: siteTypes } = await supabase
        .from('content_sitetype')
        .select('*')
        .order('name')

      if (siteTypes) {
        setAvailableSiteTypes(siteTypes)
      }
    }

    fetchSiteTypes()
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSiteTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value))
    setSelectedSiteTypes(selectedOptions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
  
    try {
      // Update site
      const { data: updatedSite, error: updateError } = await supabase
        .from('content_site')
        .update({
          ...formData
        })
        .eq('id', site.id)
        .select()
        .single()
  
      if (updateError) throw updateError
  
      // Delete existing site type relationships
      const { error: deleteError } = await supabase
        .from('content_site_site_type')
        .delete()
        .eq('site_id', site.id)
  
      if (deleteError) throw deleteError
  
      // Insert new site type relationships
      if (selectedSiteTypes.length > 0) {
        // Generate unique IDs for each relationship
        const siteTypeRelations = selectedSiteTypes.map(siteTypeId => ({
          id: Math.floor(Math.random() * 1000000), // Generate a random ID
          site_id: site.id,
          sitetype_id: siteTypeId
        }))
  
        const { error: insertError } = await supabase
          .from('content_site_site_type')
          .insert(siteTypeRelations)
  
        if (insertError) throw insertError
      }
  
      // Fetch the updated site with all relations
      const { data: finalSite, error: fetchError } = await supabase
        .from('content_site')
        .select(`
          *,
          content_site_site_type (
            content_sitetype (*)
          )
        `)
        .eq('id', site.id)
        .single()
  
      if (fetchError) throw fetchError
  
      onUpdate(finalSite as SiteWithRelations)
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
        <DialogTitle>Edit Site</DialogTitle>

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
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                URL
                <input
                  type="url"
                  name="url"
                  value={formData.url}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Feed URL
                <input
                  type="url"
                  name="feed_url"
                  value={formData.feed_url || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Site Types
                <select
                  multiple
                  value={selectedSiteTypes.map(String)}
                  onChange={handleSiteTypeChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                >
                  {availableSiteTypes.map(siteType => (
                    <option key={siteType.id} value={siteType.id}>
                      {siteType.name}
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
                <option value="P">Published</option>
                <option value="D">Draft</option>
              </select>
            </label>
          </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  name="include_in_newsfeed"
                  checked={formData.include_in_newsfeed}
                  onChange={handleChange}
                  className="mr-2 rounded border-gray-300 dark:border-gray-700"
                />
                Include in Newsfeed
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
