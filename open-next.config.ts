import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  // Persist prerendered pages, on-demand article renders and fetch cache in R2.
  incrementalCache: r2IncrementalCache,

  // Required for revalidatePath() / revalidateTag() to work.
  tagCache: d1NextTagCache,

  // Revalidate in-request. No Durable Object or Queue binding needed.
  queue: "direct",

  // Leave off initially; it is a dangerous flag and can be tested later.
  enableCacheInterception: false,

  // Keep this; other values increase cold-start CPU usage.
  routePreloadingBehavior: "none",
});
