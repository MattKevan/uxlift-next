'use client'

import { useState } from 'react'
import { Bookmark, Lightning } from '@mynaui/icons-react'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from './catalyst/dialog'
import { Button } from './catalyst/button'
import { useRouter } from 'next/navigation'

export function AuthModals() {
  const [feedModalOpen, setFeedModalOpen] = useState(false)
  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false)
  const router = useRouter()

  const handleCreateAccount = () => {
    setFeedModalOpen(false)
    setBookmarkModalOpen(false)
    router.push('/register') // Or whatever your registration path is
  }

  return (
    <>
      <button 
        className='border-l p-4 hover:bg-accent transition-colors text-gray-500'
        onClick={() => setFeedModalOpen(true)}
      >
        <Lightning/>
      </button>
      <button 
        className='border-x p-4 hover:bg-accent transition-colors text-gray-500'
        onClick={() => setBookmarkModalOpen(true)}
      >
        <Bookmark/>
      </button>

      {/* Feed Modal */}
      <Dialog open={feedModalOpen} onClose={() => setFeedModalOpen(false)}>
        <DialogTitle>Newsfeed</DialogTitle>
        <DialogDescription>
          Create an account to get a personalised feed of UX content tailored to your interests.
        </DialogDescription>
        <DialogBody>
          <p className="text-gray-600 dark:text-gray-400">
            With a UX Lift account you can:
            <ul className="list-disc list-inside mt-4">
              <li>Get content recommendations based on your interests</li>
              <li>Follow your favorite topics and authors</li>
              <li>Save articles to read later</li>
            </ul>
          </p>
        </DialogBody>
        <DialogActions>
          <Button onClick={() => setFeedModalOpen(false)}>Close</Button>
          <Button color="white" onClick={handleCreateAccount}>Create Account</Button>
        </DialogActions>
      </Dialog>

      {/* Bookmark Modal */}
      <Dialog open={bookmarkModalOpen} onClose={() => setBookmarkModalOpen(false)}>
        <DialogTitle>Save Content for Later</DialogTitle>
        <DialogDescription>
          Create an account to bookmark articles and resources to read when you have time.
        </DialogDescription>
        <DialogBody>
          <p className="text-gray-600 dark:text-gray-400">
            With bookmarks you can:
            <ul className="list-disc list-inside mt-4">
              <li>Save articles to read later</li>
              <li>Organize content into collections</li>
              <li>Access your saved content from any device</li>
            </ul>
          </p>
        </DialogBody>
        <DialogActions>
          <Button onClick={() => setBookmarkModalOpen(false)}>Close</Button>
          <Button color="white" onClick={handleCreateAccount}>Create Account</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
