"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ResourceCard } from "@/components/ResourceCard";

type Props = {
  categories: any[];
  resources: any[];
  topics: any[];
};

export default function ResourceBrowser({
  categories,
  resources,
  topics,
}: Props) {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");

  const filtered = category
    ? resources.filter(
        (resource) =>
          resource.resource_category?.slug === category ||
          resource.resource_category_id ===
            categories.find((item) => item.slug === category)?.id,
      )
    : resources;

  return (
    <>
      <section className="mb-8">
        <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
          Filter by resource category
        </h2>
        <div className="p-4 border-b flex flex-wrap gap-2">
          <Link
            href="/resources"
            className={`px-3 py-1 rounded-full text-sm border ${
              !category
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "hover:bg-gray-100 dark:hover:bg-gray-900"
            }`}
          >
            All
          </Link>
          {categories.map((resourceCategory) => (
            <Link
              key={resourceCategory.id}
              href={`/resources?category=${resourceCategory.slug}`}
              className={`px-3 py-1 rounded-full text-sm border ${
                category === resourceCategory.slug
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "hover:bg-gray-100 dark:hover:bg-gray-900"
              }`}
            >
              {resourceCategory.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
          Browse by topic
        </h2>
        <div className="p-4 border-b flex flex-wrap gap-2">
          {topics.map((topic: any) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}#resources`}
              className="px-3 py-1 rounded-full text-sm border hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              {topic.name}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="px-4 py-3 md:py-4 font-bold bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-[57px] border-b z-30">
          {filtered.length} resources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((resource: any) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-gray-600 p-4">No resources found for this filter.</p>
        )}
      </section>
    </>
  );
}
