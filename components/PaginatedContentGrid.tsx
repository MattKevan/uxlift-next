"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Pager } from "@/components/Pager";
import { BookCard } from "@/components/BookCards";
import { NewsletterPost } from "@/components/NewsletterPost";

type Props =
  | {
      kind: "books";
      initialItems: any[];
      pageSize: number;
      totalPages: number;
      basePath: string;
    }
  | {
      kind: "newsletter";
      initialItems: any[];
      pageSize: number;
      totalPages: number;
      basePath: string;
    };

async function fetchPage(
  supabase: ReturnType<typeof createClient>,
  kind: "books" | "newsletter",
  page: number,
  pageSize: number,
) {
  const offset = (page - 1) * pageSize;

  if (kind === "books") {
    const { data, error } = await supabase
      .from("content_book")
      .select(`
        id,
        title,
        description,
        authors,
        publisher,
        link,
        image_path,
        free,
        status,
        topics:content_book_topics(
          topic:topic_id(
            id,
            name,
            slug
          )
        )
      `)
      .eq("status", "published")
      .order("title", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return data ?? [];
  }

  const { data, error } = await supabase
    .from("newsletter_posts")
    .select("id, slug, title, subtitle, thumbnail_url, publish_date")
    .eq("status", "confirmed")
    .order("publish_date", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw error;

  return data ?? [];
}

export default function PaginatedContentGrid({
  kind,
  initialItems,
  pageSize,
  totalPages,
  basePath,
}: Props) {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const requestedPage = Number(searchParams.get("page") || "1");
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(Math.floor(requestedPage), Math.max(totalPages, 1))
      : 1;

  const [items, setItems] = useState<any[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentPage === 1) {
      setItems(initialItems);
      setError(null);
      return;
    }

    let active = true;

    setLoading(true);
    setError(null);

    fetchPage(supabase, kind, currentPage, pageSize)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load items.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentPage, initialItems, kind, pageSize, supabase]);

  return (
    <>
      {error && (
        <p className="border-b px-6 py-4 text-sm text-red-600">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-b">
        {loading
          ? Array.from({ length: Math.min(pageSize, 6) }).map((_, index) => (
              <div
                key={index}
                className="h-48 animate-pulse border-b border-r bg-gray-100/60 dark:bg-gray-900/60"
              />
            ))
          : items.map((item) =>
              kind === "books" ? (
                <BookCard key={item.id} book={item} />
              ) : (
                <NewsletterPost key={item.id} post={item} />
              ),
            )}
      </div>

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
