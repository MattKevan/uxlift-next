import { Sidebar, SidebarBody, SidebarHeader, SidebarItem, SidebarLabel, SidebarSection } from '@/components/catalyst/sidebar'
import {
    Dropdown,
    DropdownButton,
    DropdownDivider,
    DropdownItem,
    DropdownLabel,
    DropdownMenu,
  } from '@/components/catalyst/dropdown'
import { Avatar } from './catalyst/avatar'
import { ChevronDoubleDownIcon } from '@heroicons/react/16/solid'

export default function MobileSidebar() {
    return (
<Sidebar>
<SidebarHeader>
  
</SidebarHeader>
<SidebarBody>
  <SidebarSection>
  <SidebarItem href="/">
          Home
        </SidebarItem>
        <SidebarItem href="/news">News</SidebarItem>

        <SidebarItem href="/topics">Topics</SidebarItem>
        <SidebarItem href="/tools">Tools</SidebarItem>
  </SidebarSection>
</SidebarBody>
</Sidebar>
    )
}

