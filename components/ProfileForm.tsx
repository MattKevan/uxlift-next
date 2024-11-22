'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'
import { CldUploadWidget } from 'next-cloudinary'
import TopicSelector from './TopicSelector'
import { useNotification } from '@/contexts/NotificationContext'

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
  const [imageUrl, setImageUrl] = useState(profile?.image_url || '')
  const [website, setWebsite] = useState(profile?.website || '')
  const [linkedin, setLinkedin] = useState(profile?.linkedin || '')
  const [bluesky, setBluesky] = useState(profile?.bluesky || '')
  const [biography, setBiography] = useState(profile?.biography || '')
  const [role, setRole] = useState(profile?.role || '')
  const { addNotification } = useNotification()

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
    setImageUrl(imageInfo.secure_url); // Save the secure_url instead of public_id
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
      website,
      linkedin,
      bluesky,
      biography,
      role,
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
      <div className='p-4 max-w-6xl'>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Profile Image
          </label>
          
          <div className="flex items-start space-x-4">
            {/* Current/Uploaded Image Preview */}
            <div className="w-32 h-32 relative border rounded-full overflow-hidden bg-gray-50 dark:bg-gray-800">
              {(uploadedImage?.secure_url || imageUrl) && (
                <img
                  src={uploadedImage?.secure_url || imageUrl}
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
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {imageUrl ? 'Change Image' : 'Upload Image'}
                  </button>
                )}
              </CldUploadWidget>

              {imageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl('');
                    setUploadedImage(null);
                  }}
                  className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 dark:bg-gray-800 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Remove Image
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 mt-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Username*
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  validateUsername(e.target.value)
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                required
              />
            </label>
            {usernameError && (
              <p className="text-red-500 text-sm mt-1">{usernameError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Role
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                placeholder="e.g. UX Designer at Company"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Biography
              <textarea
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 h-32"
                placeholder="Tell us about yourself..."
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Website
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                placeholder="https://your-website.com"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              LinkedIn Profile
              <input
                type="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                placeholder="https://linkedin.com/in/your-profile"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Bluesky Handle
              <input
                type="text"
                value={bluesky}
                onChange={(e) => setBluesky(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                placeholder="@handle.bsky.social"
              />
            </label>
          </div>
        </div>
      </div>

      <h2 id="interests" className="text-lg font-bold px-4 pt-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] pb-4 border-b z-40">
        Your interests
      </h2>

      <div className='p-4 max-w-6xl'>
        <TopicSelector 
          selectedTopics={selectedTopics}
          onChange={setSelectedTopics}
        />

        {error && (
          <p className="text-red-500 mt-4">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading || !!usernameError}
          className="w-full bg-blue-600 text-white px-4 py-2 mt-6 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
        >
          {isLoading ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
        </button>
      </div>
    </form>
  )
}
