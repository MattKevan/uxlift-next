'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import EditUserModal from '@/components/EditUserModal'
import type { AdminUser, AdminUsersListResponse } from '@/types/admin-users'

const USERS_PER_PAGE = 50

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [count, setCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / USERS_PER_PAGE)), [count])

  const fetchUsers = async (page = currentPage) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/users?page=${page}&perPage=${USERS_PER_PAGE}`, {
        cache: 'no-store',
      })
      const result = await response.json() as AdminUsersListResponse | { error?: string }

      if (!response.ok) {
        throw new Error('error' in result ? result.error : 'Failed to fetch users')
      }

      const usersResponse = result as AdminUsersListResponse
      setUsers(usersResponse.users)
      setCount(usersResponse.total)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch users')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(currentPage)
  }, [currentPage])

  const handleEdit = (user: AdminUser) => {
    setSelectedUser(user)
    setIsModalOpen(true)
  }

  const handleUpdatedUser = (updatedUser: AdminUser) => {
    setUsers((currentUsers) => currentUsers.map((user) => (user.userId === updatedUser.userId ? updatedUser : user)))
  }

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Delete user ${user.username || user.email || user.userId}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${user.userId}`, {
        method: 'DELETE',
      })
      const result = await response.json() as { error?: string }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user')
      }

      const nextCount = Math.max(0, count - 1)
      const nextPage = Math.min(currentPage, Math.max(1, Math.ceil(nextCount / USERS_PER_PAGE)))

      if (nextPage !== currentPage) {
        setCurrentPage(nextPage)
      } else {
        fetchUsers(nextPage)
      }
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : 'Failed to delete user')
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Manage Users</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full rounded-lg border bg-white font-sans dark:border-gray-700 dark:bg-gray-800">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Newsletter</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Email Confirmed</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Admin</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  {user.username ? (
                    <Link
                      href={`/profile/${encodeURIComponent(user.username)}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {user.username}
                    </Link>
                  ) : (
                    <div className="font-medium dark:text-white">—</div>
                  )}
                  {user.name && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.name}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{user.email || '—'}</td>
                <td className="px-6 py-4 text-sm">{user.newsletterSubscriber ? 'Yes' : 'No'}</td>
                <td className="px-6 py-4 text-sm">{user.emailConfirmed ? 'Yes' : 'No'}</td>
                <td className="px-6 py-4 text-sm">{user.role || '—'}</td>
                <td className="px-6 py-4 text-sm">{user.isAdmin ? 'Yes' : 'No'}</td>
                <td className="px-6 py-4">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-6 text-center text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-6 py-6 text-center text-sm text-gray-500">
                  Loading users...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {count === 0 ? 0 : (currentPage - 1) * USERS_PER_PAGE + 1} to{' '}
          {Math.min(currentPage * USERS_PER_PAGE, count)} of {count} users
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

      {selectedUser && (
        <EditUserModal
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedUser(null)
          }}
          onSave={handleUpdatedUser}
        />
      )}
    </div>
  )
}
