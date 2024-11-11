'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'
import { CldUploadWidget } from 'next-cloudinary'
import TopicSelector from './TopicSelector'

type Profile = Database['public']['Tables']['user_profiles']['Row']

const usernameRegex = /^[a-z_]+$/

interface ProfileFormProps {
  profile?: Profile
  userId: string
  initialTopics?: number[]
}

export default function ProfileForm({ profile, userId, initialTopics = [] }: ProfileFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [username, setUsername] = useState(profile?.username || '')
  const [name, setName] = useState(profile?.name || '')
  const [selectedTopics, setSelectedTopics] = useState<number[]>(initialTopics)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [uploadedImage, setUploadedImage] = useState<{
    public_id: string;
    secure_url: string;
  } | null>(null)
  const [imageUrl, setImageUrl] = useState(profile?.image_url || null)

  const validateUsername = async (username: string) => {
    if (!usernameRegex.test(username)) {
      setUsernameError('Username may only contain lowercase letters and underscores')
      return false
    }

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

  const handleImageUploadSuccess = (result: any) => {
    const imageInfo = result.info;
    setUploadedImage({
      public_id: imageInfo.public_id,
      secure_url: imageInfo.secure_url
    });
    setImageUrl(imageInfo.public_id); // Save the public_id
  };

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
      image_url: imageUrl,
    }

    try {
      // Save/update profile
      const { data: savedProfile, error: profileError } = profile
        ? await supabase
            .from('user_profiles')
            .update(profileData)
            .eq('id', profile.id)
            .select()
            .single()
        : await supabase
            .from('user_profiles')
            .insert([profileData])
            .select()
            .single()

      if (profileError) throw profileError

      // Save topic preferences
      if (selectedTopics.length > 0) {
        // First delete existing topics if updating
        if (profile) {
          await supabase
            .from('content_user_topics')
            .delete()
            .eq('user_profile_id', profile.id)
        }

        // Insert new topic relationships
        const { error: topicsError } = await supabase
          .from('content_user_topics')
          .insert(
            selectedTopics.map(topicId => ({
              user_profile_id: savedProfile.id,
              topic_id: topicId
            }))
          )

        if (topicsError) throw topicsError
      }

      router.push(`/feed`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Profile Image</label>
        
        <div className="flex items-start space-x-4">
          {/* Current/Uploaded Image Preview */}
          <div className="w-32 h-32 relative border rounded-full overflow-hidden">
            {(uploadedImage?.secure_url || imageUrl) && (
              <img
                src={uploadedImage?.secure_url || `https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/${imageUrl}`}
                alt="Profile picture"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="flex flex-col space-y-2">
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
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  {imageUrl ? 'Change Image' : 'Upload Image'}
                </button>
              )}
            </CldUploadWidget>

            {imageUrl && (
              <button
                type="button"
                onClick={() => {
                  setImageUrl(null);
                  setUploadedImage(null);
                }}
                className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                Remove Image
              </button>
            )}
          </div>
        </div>
      </div>

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

      <TopicSelector 
        selectedTopics={selectedTopics}
        onChange={setSelectedTopics}
      />

      {error && <p className="text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isLoading || !!usernameError}
        className="w-full bg-primary text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {isLoading ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
      </button>
    </form>
  )
}
