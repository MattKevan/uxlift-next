import { createPublicClient } from "@/utils/supabase/public";

export type SlugParam = { slug: string };

const mapSlugs = (rows: Array<{ slug: string | null }> | null): SlugParam[] =>
  (rows ?? [])
    .map((row) => row.slug)
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }));

/**
 * Pre-build the most recent articles. Older articles are still valid; they are
 * generated on first request and cached (dynamicParams = true).
 */
export async function getRecentArticleSlugs(
  limit = Number(process.env.STATIC_ARTICLE_LIMIT ?? 500),
): Promise<SlugParam[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("content_post")
    .select("slug")
    .eq("status", "published")
    .not("slug", "is", null)
    .order("date_published", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;

  return mapSlugs(data);
}

export async function getAllToolSlugs(): Promise<SlugParam[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("content_tool")
    .select("slug")
    .eq("status", "published")
    .not("slug", "is", null);

  if (error) throw error;

  return mapSlugs(data);
}

export async function getAllResourceSlugs(): Promise<SlugParam[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("content_resource")
    .select("slug")
    .eq("status", "published")
    .not("slug", "is", null);

  if (error) throw error;

  return mapSlugs(data);
}

export async function getAllNewsletterSlugs(): Promise<SlugParam[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("newsletter_posts")
    .select("slug")
    .eq("status", "confirmed")
    .not("slug", "is", null);

  if (error) throw error;

  return mapSlugs(data);
}

export async function getAllTopicSlugs(): Promise<SlugParam[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("content_topic")
    .select("slug")
    .not("slug", "is", null);

  if (error) throw error;

  return mapSlugs(data);
}

export async function getAllSiteSlugs(): Promise<SlugParam[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("content_site")
    .select("slug")
    .eq("status", "P")
    .not("slug", "is", null);

  if (error) throw error;

  return mapSlugs(data);
}
