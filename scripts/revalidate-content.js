/**
 * Nightly revalidation helper.
 *
 * Run after the content job has written to Supabase:
 *   node -r dotenv/config scripts/revalidate-content.js
 *
 * Required environment:
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SITE_URL               e.g. https://www.uxlift.org
 *   REVALIDATE_SECRET      same value as the Vercel env var
 */

const { createClient } = require("@supabase/supabase-js");

const DAYS = Number(process.env.REVALIDATE_DAYS || 2);
const SITE_URL = (process.env.SITE_URL || "https://www.uxlift.org").replace(
  /\/+$/,
  "",
);
const REVALIDATE_URL = (
  process.env.REVALIDATE_URL ||
  process.env.SITE_URL ||
  "https://www.uxlift.org"
).replace(/\/+$/, "");
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getChangedContent(supabase, since) {
  const { data: posts, error: postsError } = await supabase
    .from("content_post")
    .select("id, slug, site_id")
    .eq("status", "published")
    .gte("date_created", since);

  if (postsError) throw postsError;

  const postIds = (posts || []).map((post) => post.id);
  const siteIds = Array.from(
    new Set((posts || []).map((post) => post.site_id).filter(Boolean)),
  );

  let topicSlugs = [];
  let siteSlugs = [];

  if (postIds.length > 0) {
    const { data: postTopics, error: postTopicsError } = await supabase
      .from("content_post_topics")
      .select("topic:content_topic(slug)")
      .in("post_id", postIds);

    if (postTopicsError) throw postTopicsError;

    topicSlugs = Array.from(
      new Set(
        (postTopics || [])
          .map((row) => row.topic?.slug)
          .filter(Boolean),
      ),
    );
  }

  if (siteIds.length > 0) {
    const { data: sites, error: sitesError } = await supabase
      .from("content_site")
      .select("slug")
      .in("id", siteIds);

    if (sitesError) throw sitesError;

    siteSlugs = Array.from(
      new Set((sites || []).map((site) => site.slug).filter(Boolean)),
    );
  }

  const { data: newsletters, error: newslettersError } = await supabase
    .from("newsletter_posts")
    .select("slug")
    .eq("status", "confirmed")
    .gte("updated_at", since);

  if (newslettersError) throw newslettersError;

  const newsletterSlugs = Array.from(
    new Set((newsletters || []).map((post) => post.slug).filter(Boolean)),
  );

  const paths = new Set([
    "/",
    "/news",
    "/topics",
    "/sites",
    "/newsletter",
    "/sitemap.xml",
  ]);

  for (const post of posts || []) {
    if (post.slug) paths.add(`/articles/${post.slug}`);
  }

  for (const slug of topicSlugs) paths.add(`/topics/${slug}`);
  for (const slug of siteSlugs) paths.add(`/sites/${slug}`);
  for (const slug of newsletterSlugs) paths.add(`/newsletter/${slug}`);

  return Array.from(paths);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "Revalidation skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
    return;
  }

  if (!REVALIDATE_SECRET) {
    console.warn("Revalidation skipped: REVALIDATE_SECRET is missing.");
    return;
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const paths = await getChangedContent(supabase, since);

  console.log(
    `Revalidating ${paths.length} paths changed since ${since}:`,
    paths,
  );

  const response = await fetch(`${REVALIDATE_URL}/api/revalidate/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REVALIDATE_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paths, warm: true }),
  });

  const result = await response.text();

  if (!response.ok) {
    throw new Error(`Revalidation failed (${response.status}): ${result}`);
  }

  console.log(`Revalidation response (${response.status}):`, result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
