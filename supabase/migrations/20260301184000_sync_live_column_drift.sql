-- Align local schema with live column additions used by live data dumps.
-- Safe on remote too because all changes are IF NOT EXISTS.

ALTER TABLE public.content_post
  ADD COLUMN IF NOT EXISTS bluesky_posted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bluesky_posted_at timestamp with time zone;

ALTER TABLE public.feed_processing_jobs
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'feed_processing',
  ADD COLUMN IF NOT EXISTS current_batch integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_batches integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS batch_size integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_processed_site_id bigint,
  ADD COLUMN IF NOT EXISTS last_processed_item_id bigint,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.feed_processing_jobs
  ALTER COLUMN created_by DROP NOT NULL;
