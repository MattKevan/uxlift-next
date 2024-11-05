import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Define allowed public API routes
const publicApiRoutes: string[] = [
  // Add any public API routes here
  // '/api/public-route',
];


export const updateSession = async (request: NextRequest) => {
  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const { data: { user } } = await supabase.auth.getUser();

    // Check API routes
    if (request.nextUrl.pathname.startsWith("/api")) {
      // Check if the current route is in the public routes list
      const isPublicRoute = publicApiRoutes.includes(request.nextUrl.pathname);

      if (!isPublicRoute) {
        // If not a public route, verify admin status
        if (!user) {
          return new NextResponse(
            JSON.stringify({ error: 'Unauthorized - Not logged in' }), 
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();

        if (!profile?.is_admin) {
          return new NextResponse(
            JSON.stringify({ error: 'Unauthorized - Admin access required' }), 
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // If accessing admin routes, check if user exists and is admin
    if (request.nextUrl.pathname.startsWith("/admin")) {
      if (!user) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (!profile?.is_admin) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // Protected routes check
    if (request.nextUrl.pathname.startsWith("/protected") && !user) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return response;
  } catch (e) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
