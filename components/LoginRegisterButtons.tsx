'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function LoginRegisterButtons() {
  return (
    <div className="flex gap-2 mr-4">
      <Button asChild size="sm" variant="outline">
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant="default">
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </div>
  )
}
