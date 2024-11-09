"use client"

import * as React from "react"
import Link from "next/link"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheetSidebar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bars3Icon } from "@heroicons/react/24/outline"

interface MobileNavProps {
  items: {
    href: string
    label: string
  }[]
  moreItems: {
    href: string
    label: string
    description: string
  }[]
}

export function MobileNav({ items, moreItems }: MobileNavProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-4 border-r">
          <Bars3Icon className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <ScrollArea className="border-t h-[calc(100vh-8rem)]">
          <div className="flex flex-col">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium hover:bg-gray-50 p-4 border-b"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium hover:bg-gray-50 p-4 border-b"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
