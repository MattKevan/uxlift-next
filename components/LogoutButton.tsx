'use client'

import { signOutAction } from "@/app/actions"
import { Logout } from "@mynaui/icons-react"

export default function LogoutButton() {
  return (
    <button 
      onClick={() => signOutAction()}
      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-accent text-left text-sm"
    >
      <Logout className="size-4" />
      <span>Sign out</span>
    </button>
  )
}
