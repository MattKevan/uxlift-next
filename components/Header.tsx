import { createClient } from '@/utils/supabase/server'
import { Link } from './catalyst/link'
import { Dropdown, DropdownDivider, DropdownItem, DropdownLabel, DropdownMenu } from '@/components/catalyst/dropdown'
import { Navbar, NavbarItem, NavbarSpacer, NavbarSection } from '@/components/catalyst/navbar'
import {
  Cog8ToothIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  UserIcon,
  CommandLineIcon
} from '@heroicons/react/16/solid'
import ClientAvatarButton from '@/components/ClientAvatarButton'
import LogoutButton from '@/components/LogoutButton'
import LoginRegisterButtons from '@/components/LoginRegisterButtons'

export default async function Header() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  let profile = null
  if (user && !error) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    profile = data
  }

  return (
    <Navbar className='font-sans'>
      <Link href="/" aria-label="Home">
        <p className='font-bold text-lg text-blue-600'>UX Lift</p>
      </Link>
      
      <NavbarSection className='max-lg:hidden'>
        <NavbarItem href="/" current>Home</NavbarItem>
        <NavbarItem href="/news">News</NavbarItem>
        <NavbarItem href="/topics">Topics</NavbarItem>
        <NavbarItem href="/tools">Tools</NavbarItem>
      </NavbarSection>
      
      <NavbarSpacer />
      
      {user && profile ? (
        <Dropdown>
        <ClientAvatarButton
            src={profile.avatar_url || '/default-avatar.png'}
            initials={profile.username ? profile.username[0].toUpperCase() : 'U'}
            alt="Account options"
          />          <DropdownMenu className="min-w-64" anchor="bottom end">
            <DropdownItem href={`/profile/${profile.username}`}>
              <UserIcon />
              <DropdownLabel>My profile</DropdownLabel>
            </DropdownItem>
            <DropdownItem href="/settings">
              <Cog8ToothIcon />
              <DropdownLabel>Settings</DropdownLabel>
            </DropdownItem>
            {profile.is_admin && (
              <>
                <DropdownDivider />
                <DropdownItem href="/admin/posts">
                  <CommandLineIcon />
                  <DropdownLabel>Admin</DropdownLabel>
                </DropdownItem>
              </>
            )}
           
            <DropdownDivider />
            <LogoutButton />
          </DropdownMenu>
        </Dropdown>
      ) : (
        <LoginRegisterButtons />
      )}
    </Navbar>
  )
}
