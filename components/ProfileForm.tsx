'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['user_profiles']['Row']

const usernameRegex = /^[a-z_]+$/

interface ProfileFormProps {
  profile?: Profile
  userId: string
}

export default function ProfileForm({ profile, userId }: ProfileFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [username, setUsername] = useState(profile?.username || '')
  const [name, setName] = useState(profile?.name || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [usernameError, setUsernameError] = useState('')

  const validateUsername = async (username: string) => {
    if (!usernameRegex.test(username)) {
      setUsernameError('Username may only contain lowercase letters and underscores')
      return false
    }

    // Only check uniqueness if username changed from current
    if (username !== profile?.username) {
      const { data } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('username', username)
        .single()

      if (data) {
        setUsernameError('Username already taken')
        return false
      }
    }

    setUsernameError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const isValid = await validateUsername(username)
    if (!isValid) {
      setIsLoading(false)
      return
    }

    const profileData = {
      username,
      name,
      user_id: userId,
    }

    const { error: supabaseError } = profile
      ? await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', profile.id)
      : await supabase
          .from('user_profiles')
          .insert([profileData])

    setIsLoading(false)

    if (supabaseError) {
      setError(supabaseError.message)
      return
    }

    router.push(`/profiles/${username}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-1">
          Username*
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              validateUsername(e.target.value)
            }}
            className="w-full border rounded p-2"
            required
          />
        </label>
        {usernameError && (
          <p className="text-red-500 text-sm mt-1">{usernameError}</p>
        )}
      </div>

      <div>
        <label className="block mb-1">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded p-2"
          />
        </label>
      </div>

      {error && <p className="text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isLoading || !!usernameError}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {isLoading ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  )
}
