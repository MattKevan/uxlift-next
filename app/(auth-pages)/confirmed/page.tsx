'use client'
import { Button } from '@/components/catalyst/button'

// This can serve as a fallback in case something goes wrong with the automatic redirect
export default function EmailConfirmedPage() {
  return (
    <div className='px-6 mb-24 sm:mb-32 mt-6'>
      <h1 className='text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight'>
        Email address confirmed
      </h1>
      <p className='mt-4 font-sans'>
        Thanks! Your email address has been successfully confirmed and you're now signed in.
      </p>
      
      <Button href='/profile/edit' color='blue' className="mt-6">
        Create your profile
      </Button>
    </div>
  )
}