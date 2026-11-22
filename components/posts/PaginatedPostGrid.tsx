"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Pager } from "@/components/Pager";
import { PostHorizontal } from "./PostsHorizontalSmall";
import { normalizePost, type PostCardData } from "@/lib/content/post-shape";

type Source =
  | { kind: "news" }
  | { kind: "topic"; topicId: number }
  | { kind: "site"; siteId: number };

type Props = {
  source: Source;
  initialPosts: PostCardData[];
  initialPage?: number;
  pageSize: number;
  totalPages: number;
  basePath: string;
  emptyMessage?: string;
};

const POST_FIELDS = `
  id,
  slug,
  title,
  description,
  date_published,
  link,
  image_path,
  site:content_site!left (
    title,
    slug,
    site_icon
  ),
  content_post_topics!left (
    topic:content_topic (
      id,
      name,
      slug
    )
  )
`;

const TOPIC_POST_FIELDS = `
  post:content_post!inner (
    id,
    slug,
    title,
    description,
    date_published,
    link,
    image_path,
    site:content_site!left (
      title,
      slug,
      site_icon
    )
  )
`;

async function fetchPage(
  supabase: ReturnType<typeof createClient>,
  source: Source,
  page: number,
  pageSize: number,
): Promise<PostCardData[]> {
  const offset = (page - 1) * pageSize;

  if (source.kind === "topic") {
    const { data, error } = await supabase
      .from("content_post_topics")
      .select(TOPIC_POST_FIELDS)
      .eq("topic_id", source.topicId)
      .eq("post.status", "published")
      .order("post(date_published)", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      ...normalizePost(row.post),
      content_post_topics: [],
    }));
  }

  let query = supabase
    .from("content_post")
    .select(POST_FIELDS)
    .eq("status", "published")
    .order("date_published", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (source.kind === "site") {
    query = query.eq("site_id", source.siteId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map(normalizePost);
}

export default function PaginatedPostGrid({
  source,
  initialPosts,
  initialPage = 1,
  pageSize,
  totalPages,
  basePath,
  emptyMessage = "No posts found.",
}: Props) {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const requestedPage = Number(searchParams.get("page") || "1");
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(Math.floor(requestedPage), Math.max(totalPages, 1))
      : 1;

  const [posts, setPosts] = useState<PostCardData[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceKey =
    source.kind === "topic"
      ? `topic:${source.topicId}`
      : source.kind === "site"
        ? `site:${source.siteId}`
        : "news";

  useEffect(() => {
    if (currentPage === initialPage) {
      setPosts(initialPosts);
      setError(null);
      return;
    }

    let active = true;

    setLoading(true);
    setError(null);

    fetchPage(supabase, source, currentPage, pageSize)
      .then((rows) => {
        if (active) setPosts(rows);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load posts.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // source is represented by sourceKey to avoid refetching on object identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, initialPage, initialPosts, pageSize, sourceKey, supabase]);

  return (
    <>
      {error && (
        <p className="border-b px-6 py-4 text-sm text-red-600">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 border-b">
        {loading
          ? Array.from({ length: Math.min(pageSize, 8) }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse border-b bg-gray-100/60 dark:bg-gray-900/60"
              />
            ))
          : posts.map((post) => (
              <PostHorizontal key={post.id} post={post} />
            ))}
      </div>

      {!loading && posts.length === 0 && (
        <p className="border-b px-6 py-6 text-gray-600">{emptyMessage}</p>
      )}

      {totalPages > 1 && (
        <Pager
          currentPage={currentPage}
          totalPages={totalPages}
          baseUrl={basePath}
        />
      )}
    </>
  );
}
