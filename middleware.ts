// middleware.ts

import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Only authenticated areas and API routes need a session. Public content
     * pages must stay out of middleware so they can be served from the cache.
     */
    '/admin/:path*',
    '/protected/:path*',
    '/profile/edit/:path*',
    '/profile/create/:path*',
    '/api/:path*',
  ],
};
