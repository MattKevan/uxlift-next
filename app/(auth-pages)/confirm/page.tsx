//src/app/(public)/confirm/page.tsx
'use client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect } from 'react'

export default function ConfirmPage() {

  return (
    <main className=" mx-auto">
      <div className="px-6 mb-24 sm:mb-32 mt-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
        Confirm your email address
        </h1>
        
        <p className='mt-4 font-sans'>
          We&apos;ve sent a confirmation email to your address. Please check your inbox and click the link to confirm your account.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Return to home</Link>
        </Button>
      </div>
      </main>
  )
}