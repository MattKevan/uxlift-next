'use client'
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem, DropdownLabel, DropdownDivider } from '@/components/catalyst/dropdown'
import { ChevronDown } from '@mynaui/icons-react'
import clsx from 'clsx'

interface MenuDropdownProps {
  label: string
  items: {
    href: string
    label: string
    divider?: boolean
  }[]
}

export function MenuDropdown({ label, items }: MenuDropdownProps) {
  return (
    <Dropdown>
      <DropdownButton 
        as="button" 
        className='hover:bg-gray-50 dark:hover:bg-gray-900 p-4 flex items-center gap-1 border-none'
      >
        {label}
        <ChevronDown className="size-4" />
      </DropdownButton>
      <DropdownMenu className="min-w-64 flex flex-col" anchor="bottom start">
        {items.map((item, index) => (
          <div key={item.href} className="flex flex-col w-full">
            <DropdownItem href={item.href}>
              <DropdownLabel>{item.label}</DropdownLabel>
            </DropdownItem>
            {item.divider && <DropdownDivider />}
          </div>
        ))}
      </DropdownMenu>
    </Dropdown>
  )
}
