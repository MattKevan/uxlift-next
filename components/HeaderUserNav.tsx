"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createClient } from "@/utils/supabase/client";
import { Lightning } from "@mynaui/icons-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import UserMenuButton from "./UserMenuButton";
import LoginRegisterButtons from "./LoginRegisterButtons";
import SubmitContentButton from "./SubmitContentButton";

type Profile = Database["public"]["Tables"]["user_profiles"]["Row"];

export default function HeaderUserNav() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setReady(true);
        return;
      }

      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (!active) return;

      setUser(session.user);
      setProfile(data);
      setReady(true);
    };

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Reserve the same space as the signed-in controls to avoid layout shift.
  if (!ready) {
    return <div className="h-[52px] w-[140px] sm:w-[190px]" aria-hidden="true" />;
  }

  if (!user || !profile) {
    return (
      <>
        <Button variant="outline" className="mr-4" asChild>
          <Link href="/sign-in">Submit content</Link>
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="border-x p-4 hover:bg-accent transition-colors"
              aria-label="Learn about the personalised feed"
            >
              <Lightning aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="text-sm">
            Sign in or sign up to create a personalised feed of UX articles and
            news.
          </PopoverContent>
        </Popover>
        <LoginRegisterButtons />
      </>
    );
  }

  return (
    <>
      <SubmitContentButton user={user} profile={profile} />
      <Link
        className="border-x p-4 hover:bg-accent transition-colors text-gray-500"
        href="/feed"
      >
        <Lightning aria-hidden="true" />
        <span className="sr-only">Go to your personalised feed</span>
      </Link>
      <UserMenuButton user={user} profile={profile} />
    </>
  );
}
