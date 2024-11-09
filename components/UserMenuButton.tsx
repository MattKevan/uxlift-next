import { User } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'
import Link from 'next/link'
import { CommandLineIcon, Cog8ToothIcon, UserIcon } from '@heroicons/react/16/solid'
import { Avatar } from '@/components/catalyst/avatar'
import LogoutButton from './LogoutButton'
import { Cog, Command, UserCircle } from '@mynaui/icons-react'

type Profile = Database['public']['Tables']['user_profiles']['Row']

interface UserMenuButtonProps {
  user: User
  profile: Profile
}

export default function UserMenuButton({ user, profile }: UserMenuButtonProps) {
  return (
    <div className="relative group">
      <button className="p-[12px] flex items-center gap-2 hover:bg-accent transition-colors">
        <Avatar
          src="/default-avatar.png"
          alt={profile.name || profile.username}
          className="size-8"
        >
          <span>{profile.name ? profile.name[0].toUpperCase() : profile.username[0].toUpperCase()}</span>
        </Avatar>
      </button>
      <div className="absolute hidden group-hover:block w-[200px] top-full right-0 bg-background border shadow-lg divide-y divide-border">
        <div className="p-4">
          <div className="text-sm">{profile.name || profile.username}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
        <div className="">
          <Link 
            href={`/profile/${profile.username}`}
            className="flex items-center gap-2 px-4 py-2 hover:bg-accent text-sm"
          >
            <UserCircle className="size-4" />
            <span>My profile</span>
          </Link>
          <Link 
            href="/settings"
            className="flex items-center gap-2 px-4 py-2 hover:bg-accent text-sm"
          >
            <Cog className="size-4" />
            <span>Settings</span>
          </Link>
        </div>
        {profile.is_admin && (
          <div className="">
            <Link 
              href="/admin/posts"
              className="flex items-center gap-2 px-4 py-2 hover:bg-accent text-sm"
            >
              <Command className="size-4" />
              <span>Admin</span>
            </Link>
          </div>
        )}
        <div className="">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
