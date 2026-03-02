ALTER TABLE public.search_history
ADD COLUMN IF NOT EXISTS result_payload jsonb;
