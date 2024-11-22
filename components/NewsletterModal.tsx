import { Dialog, DialogTitle, DialogDescription } from './catalyst/dialog'
import { useState } from 'react'

interface NewsletterModalProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

export function NewsletterModal({ isOpen, setIsOpen }: NewsletterModalProps) {
  return (
    <Dialog open={isOpen} onClose={() => setIsOpen(false)} size='xl'>
      
      <div className="mt-4">
        <iframe 
          src="https://embeds.beehiiv.com/9d493c10-b8b3-41a9-9e8a-1d5767d98d81" 
          data-test-id="beehiiv-embed" 
          width="100%" 
          height="320" 
          className="dark:bg-gray-950 bg-white"
        />
      </div>
    </Dialog>
  )
}
