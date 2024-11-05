import { Avatar } from '@/components/catalyst/avatar'
import { Link } from './catalyst/link'
import { Dropdown, DropdownDivider, DropdownItem, DropdownLabel, DropdownMenu, DropdownButton } from '@/components/catalyst/dropdown'
import { Navbar, NavbarItem, NavbarSpacer, NavbarSection } from '@/components/catalyst/navbar'
import {
  ArrowRightStartOnRectangleIcon,
  Cog8ToothIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@heroicons/react/16/solid'
import AuthButton from './header-auth'

export default function Header() {
  return (
    <Navbar className='font-sans'>
      <Link href="/" aria-label="Home">
        <p className='font-bold text-lg'>UX Lift</p>
      </Link>
      <NavbarSection>
        <NavbarItem href="/" current>
          Home
        </NavbarItem>
        <NavbarItem href="/news">News</NavbarItem>

        <NavbarItem href="/topics">Topics</NavbarItem>
        <NavbarItem href="/tools">Tools</NavbarItem>

      </NavbarSection>
      <NavbarSpacer />
      
      <AuthButton/>
    </Navbar>
  )
}