'use client'

import { useState } from 'react'
import { NewsletterModal } from './NewsletterModal'
import { Envelope } from '@mynaui/icons-react'

interface SubscribeButtonProps {
  isSubscriber: boolean
}

export function SubscribeButton({ isSubscriber }: SubscribeButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (isSubscriber) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[10px] right-[10px] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-colors duration-200 z-50 flex items-center gap-2"
      >
        <Envelope  className='size-6' /> <span className='hidden md:block'>Subscribe</span>
      </button>
      <NewsletterModal isOpen={isOpen} setIsOpen={setIsOpen} />
    </>
  )
}
