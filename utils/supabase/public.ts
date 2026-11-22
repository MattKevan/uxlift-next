import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-less Supabase client for public, cacheable content.
 *
 * Use this for pages that can be statically generated or revalidated. It does
 * not read cookies, so it does not opt a route into dynamic rendering.
 *
 * Auth-aware pages/actions should keep using `@/utils/supabase/server`.
 */
export const createPublicClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
