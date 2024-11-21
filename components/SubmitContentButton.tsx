// components/SubmitContentButton.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import SubmitContentModal from '@/components/SubmitPostModal'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['user_profiles']['Row']

interface SubmitContentButtonProps {
  user: User
  profile: Profile
}

export default function SubmitContentButton({ user, profile }: SubmitContentButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleSuccess = (post: Database['public']['Tables']['content_post']['Row']) => {
    // Handle successful submission - could show a success message, redirect, etc.
    console.log('Content submitted successfully:', post)
  }

  return (
    <>
      <Button 
        className='mr-4' 
        size='sm' 
        variant='outline'
        onClick={() => setIsModalOpen(true)}
      >
        Submit content
      </Button>

      <SubmitContentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  )
}
