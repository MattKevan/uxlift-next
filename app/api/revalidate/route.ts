import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

type RevalidateBody = {
  paths?: unknown;
  warm?: unknown;
};

const isValidPath = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');

const normalizePath = (path: string): string => {
  if (path === '/') return '/';

  // File routes (sitemaps, robots.txt, etc.) do not get a trailing slash.
  if (/\.[a-z0-9]+$/i.test(path)) return path;

  return path.endsWith('/') ? path : `${path}/`;
};

/**
 * Called by the nightly content job after Supabase has been updated.
 *
 * Body: { paths: string[], warm?: boolean }
 * Auth: Authorization: Bearer $REVALIDATE_SECRET
 *
 * New article slugs do not need to be listed: with `dynamicParams = true`
 * they are rendered on first request and cached. Listing pages, topic pages,
 * the home page and sitemaps do need revalidating.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: 'REVALIDATE_SECRET is not configured' },
      { status: 500 },
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: RevalidateBody;

  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const paths = Array.isArray(body.paths)
    ? Array.from(new Set(body.paths.filter(isValidPath).map(normalizePath)))
    : [];

  if (paths.length === 0) {
    return NextResponse.json(
      { error: 'No valid paths supplied' },
      { status: 400 },
    );
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  // App Router revalidation is lazy. The nightly job can opt into warming the
  // changed paths so the next visitor gets a fresh cached response.
  if (body.warm === true) {
    const origin = new URL(request.url).origin;

    await Promise.allSettled(
      paths.map((path) =>
        fetch(new URL(path, origin), {
          cache: 'no-store',
          headers: { 'x-uxlift-revalidate': '1' },
        }),
      ),
    );
  }

  return NextResponse.json({ revalidated: paths });
}
