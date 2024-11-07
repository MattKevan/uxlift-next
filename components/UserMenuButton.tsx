'use client'

import { User } from '@supabase/supabase-js'
import { Dropdown, DropdownDivider, DropdownItem, DropdownLabel, DropdownMenu } from '@/components/catalyst/dropdown'
import ClientAvatarButton from '@/components/ClientAvatarButton'
import { CommandLineIcon, Cog8ToothIcon, UserIcon } from '@heroicons/react/16/solid'
import LogoutButton from '@/components/LogoutButton'
import { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['user_profiles']['Row']

interface UserMenuButtonProps {
  user: User
  profile: Profile
}

export default function UserMenuButton({ user, profile }: UserMenuButtonProps) {
  return (
    <Dropdown>
      <ClientAvatarButton
        src="/default-avatar.png" // Using default avatar since there's no avatar field in the schema
        initials={profile.name ? profile.name[0].toUpperCase() : profile.username[0].toUpperCase()}
        alt={profile.name || profile.username}
      />
      <DropdownMenu className="min-w-64" anchor="bottom end">
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
  )
}
