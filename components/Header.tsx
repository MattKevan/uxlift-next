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
        <NavbarItem href="/topics">Topics</NavbarItem>
        <NavbarItem href="/news">News</NavbarItem>
      </NavbarSection>
      <NavbarSpacer />
      <Dropdown>
        <DropdownButton as={NavbarItem} aria-label="Account menu">
          <Avatar src="/profile-photo.jpg" square />
        </DropdownButton>
        <DropdownMenu className="min-w-64" anchor="bottom end">
          <DropdownItem href="/my-profile">
            <UserIcon />
            <DropdownLabel>My profile</DropdownLabel>
          </DropdownItem>
          <DropdownItem href="/settings">
            <Cog8ToothIcon />
            <DropdownLabel>Settings</DropdownLabel>
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem href="/privacy-policy">
            <ShieldCheckIcon />
            <DropdownLabel>Privacy policy</DropdownLabel>
          </DropdownItem>
          <DropdownItem href="/share-feedback">
            <LightBulbIcon />
            <DropdownLabel>Share feedback</DropdownLabel>
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem href="/logout">
            <ArrowRightStartOnRectangleIcon />
            <DropdownLabel>Sign out</DropdownLabel>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
      <AuthButton/>
    </Navbar>
  )
}