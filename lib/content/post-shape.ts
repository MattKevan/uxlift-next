export type PostCardData = {
  id: number;
  slug: string | null;
  title: string | null;
  description: string | null;
  date_published: string | null;
  link: string;
  image_path: string | null;
  site: {
    title: string | null;
    slug: string | null;
    site_icon: string | null;
  } | null;
  content_post_topics: Array<{
    topic: { id: number; name: string; slug: string };
  }>;
};

/**
 * Normalize the different Supabase embed shapes (object vs array) into the
 * shape consumed by PostHorizontal.
 */
export function normalizePost(post: any): PostCardData {
  const site = Array.isArray(post.site) ? post.site[0] : post.site;

  return {
    id: post.id,
    slug: post.slug ?? null,
    title: post.title ?? null,
    description: post.description ?? null,
    date_published: post.date_published ?? null,
    link: post.link,
    image_path: post.image_path ?? null,
    site: site
      ? {
          title: site.title ?? null,
          slug: site.slug ?? null,
          site_icon: site.site_icon ?? null,
        }
      : null,
    content_post_topics: (post.content_post_topics ?? [])
      .map((item: any) => ({
        topic: Array.isArray(item.topic) ? item.topic[0] : item.topic,
      }))
      .filter((item: any) => item.topic),
  };
}
