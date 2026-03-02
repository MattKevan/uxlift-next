'use client'

import { useEffect, useState } from 'react'
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
import type { AdminUser, AdminUserUpdatePayload } from '@/types/admin-users'

interface EditUserModalProps {
  user: AdminUser
  isOpen: boolean
  onClose: () => void
  onSave: (updatedUser: AdminUser) => void
}

function buildInitialForm(user: AdminUser): AdminUserUpdatePayload {
  return {
    username: user.username || '',
    name: user.name || '',
    email: user.email || '',
    role: user.role || '',
    isAdmin: user.isAdmin,
    newsletterSubscriber: user.newsletterSubscriber,
  }
}

export default function EditUserModal({ user, isOpen, onClose, onSave }: EditUserModalProps) {
  const [formData, setFormData] = useState<AdminUserUpdatePayload>(buildInitialForm(user))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitialForm(user))
      setError('')
    }
  }, [user, isOpen])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/users/${user.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user')
      }

      onSave(result.user as AdminUser)
      onClose()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update user')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-user-username">Username</Label>
            <Input
              id="edit-user-username"
              type="text"
              value={formData.username}
              onChange={(event) => setFormData((current) => ({ ...current, username: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-name">Name</Label>
            <Input
              id="edit-user-name"
              type="text"
              value={formData.name}
              onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              type="email"
              value={formData.email}
              onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-role">Role</Label>
            <Input
              id="edit-user-role"
              type="text"
              value={formData.role}
              onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))}
              placeholder="e.g. member, editor"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-user-newsletter"
              checked={formData.newsletterSubscriber}
              onCheckedChange={(checked) => {
                setFormData((current) => ({
                  ...current,
                  newsletterSubscriber: checked === true,
                }))
              }}
            />
            <Label htmlFor="edit-user-newsletter">Subscribed to newsletter</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-user-admin"
              checked={formData.isAdmin}
              onCheckedChange={(checked) => {
                setFormData((current) => ({
                  ...current,
                  isAdmin: checked === true,
                }))
              }}
            />
            <Label htmlFor="edit-user-admin">Admin access</Label>
          </div>

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
            Email confirmed: {user.emailConfirmed ? 'Yes' : 'No'}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
