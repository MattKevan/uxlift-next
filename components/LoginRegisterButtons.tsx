'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function LoginRegisterButtons() {
  return (
    <div className="flex gap-2 px-4 ">
      <Button asChild size="sm" variant="default">
        <Link href="/sign-in">Sign in</Link>
      </Button>
     
    </div>
  )
}
