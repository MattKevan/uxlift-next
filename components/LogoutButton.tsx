'use client'

import { signOutAction } from "@/app/actions"
import { DropdownItem, DropdownLabel } from "@/components/catalyst/dropdown"
import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/16/solid"

export default function LogoutButton() {
  return (
    <DropdownItem onClick={() => signOutAction()}>
      <ArrowRightStartOnRectangleIcon />
      <DropdownLabel>Sign out</DropdownLabel>
    </DropdownItem>
  )
}
