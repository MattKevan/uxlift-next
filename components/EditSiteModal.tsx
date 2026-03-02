'use client'

import { useState, useEffect } from 'react'
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
    user_id: site.user_id,
    include_in_newsfeed: site.include_in_newsfeed,
  })
  const [selectedSiteTypes, setSelectedSiteTypes] = useState<Option[]>(
    site.content_site_site_type.map((st) => ({
      value: String(st.content_sitetype.id),
      label: st.content_sitetype.name,
    }))
  )
  const [availableSiteTypes, setAvailableSiteTypes] = useState<SiteType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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
  }, [supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSiteTypeChange = (options: Option[]) => {
    setSelectedSiteTypes(options)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('content_site')
        .update({
          ...formData,
        })
        .eq('id', site.id)

      if (updateError) throw updateError

      const { error: deleteError } = await supabase
        .from('content_site_site_type')
        .delete()
        .eq('site_id', site.id)

      if (deleteError) throw deleteError

      if (selectedSiteTypes.length > 0) {
        const siteTypeRelations = selectedSiteTypes.map((siteType) => ({
          id: Math.floor(Math.random() * 1_000_000),
          site_id: site.id,
          sitetype_id: parseInt(siteType.value, 10),
        }))

        const { error: insertError } = await supabase
          .from('content_site_site_type')
          .insert(siteTypeRelations)

        if (insertError) throw insertError
      }

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Site</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-title">Title</Label>
            <Input
              id="site-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-description">Description</Label>
            <Textarea
              id="site-description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-url">URL</Label>
            <Input
              id="site-url"
              type="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-feed-url">Feed URL</Label>
            <Input
              id="site-feed-url"
              type="url"
              name="feed_url"
              value={formData.feed_url || ''}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label>Site Types</Label>
            <MultipleSelector
              value={selectedSiteTypes}
              onChange={handleSiteTypeChange}
              options={availableSiteTypes.map((siteType) => ({
                value: String(siteType.id),
                label: siteType.name,
              }))}
              placeholder="Select site types..."
              emptyIndicator={<p className="text-center text-sm text-muted-foreground">No site types found</p>}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-status">Status</Label>
            <Select
              id="site-status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="P">Published</option>
              <option value="D">Draft</option>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="site-include-in-newsfeed"
              checked={!!formData.include_in_newsfeed}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  include_in_newsfeed: checked === true,
                }))
              }
            />
            <Label htmlFor="site-include-in-newsfeed">Include in Newsfeed</Label>
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
