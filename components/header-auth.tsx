'use client'

import { signOutAction } from "@/app/actions/actions";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/client";
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem, DropdownLabel, DropdownMenu } from "./catalyst/dropdown";
import { Avatar, AvatarButton } from '@/components/catalyst/avatar'
import { ArrowRightStartOnRectangleIcon, Cog8ToothIcon, LightBulbIcon, ShieldCheckIcon, UserIcon } from "@heroicons/react/16/solid";
import { NavbarItem } from "./catalyst/navbar";
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Database } from "@/types/supabase";
import { CommandLineIcon } from "@heroicons/react/16/solid";

type Profile = Database['public']['Tables']['user_profiles']['Row'];

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Function to fetch profile data
    async function getProfile(userId: string) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      setProfile(profile);
    }

    // Initial auth check
    const initializeAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        setUser(user);
        if (user) {
          await getProfile(user.id);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    };

    // Set up real-time auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const { data: { user }, error } = await supabase.auth.getUser();
        setUser(user);
        if (user) {
          await getProfile(user.id);
        } else {
          setProfile(null);
        }
      }
    );

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (loading) {
    return <div className="flex gap-2">Loading...</div>;
  }

  return user && profile ? (
    <Dropdown>
      <DropdownButton aria-label="Account options" plain>
        <Avatar src='/default-avatar.png' className="size-8"/>
      </DropdownButton>
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
        <DropdownItem href="/privacy-policy">
          <ShieldCheckIcon />
          <DropdownLabel>Privacy policy</DropdownLabel>
        </DropdownItem>
        <DropdownItem href="/share-feedback">
          <LightBulbIcon />
          <DropdownLabel>Share feedback</DropdownLabel>
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem onClick={() => signOutAction()}>
          <ArrowRightStartOnRectangleIcon />
          <DropdownLabel>Sign out</DropdownLabel>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
