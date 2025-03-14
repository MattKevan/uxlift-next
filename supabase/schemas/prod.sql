

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "vecs";


ALTER SCHEMA "vecs" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE OR REPLACE FUNCTION "public"."generate_unique_slug"("title" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  base_slug TEXT;
  new_slug TEXT;
  counter INTEGER := 1;
BEGIN
  -- Convert to lowercase and replace spaces/special chars with hyphens
  base_slug := lower(title);
  
  -- Remove diacritics/accents
  base_slug := unaccent(base_slug);
  
  -- Replace any character that isn't alphanumeric or hyphen with hyphen
  base_slug := regexp_replace(base_slug, '[^a-z0-9-]+', '-', 'g');
  
  -- Remove leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);
  
  -- Initial slug attempt
  new_slug := base_slug;
  
  -- Keep trying until we find a unique slug
  WHILE EXISTS (SELECT 1 FROM content_post WHERE slug = new_slug) LOOP
    new_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN new_slug;
END;
$$;


ALTER FUNCTION "public"."generate_unique_slug"("title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.5, "match_count" integer DEFAULT 10) RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer DEFAULT NULL::integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "embedding" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    (embedding::text)::jsonb as embedding,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents_optimized"("query_embedding" "public"."vector", "similarity_threshold" double precision DEFAULT 0.5, "match_count" integer DEFAULT 5) RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  SET LOCAL statement_timeout = '10s';
  
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > similarity_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_documents_optimized"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_slug_on_content_post"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only set slug if it's null or empty
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_unique_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_slug_on_content_post"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_statement_timeout"("milliseconds" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  execute format('set local statement_timeout = %s', milliseconds);
end;
$$;


ALTER FUNCTION "public"."set_statement_timeout"("milliseconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_newsletter_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


ALTER FUNCTION "public"."update_newsletter_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_activity_logs" AS
SELECT
    NULL::bigint AS "id",
    NULL::character varying(100) AS "function_name",
    NULL::"uuid" AS "execution_id",
    NULL::bigint AS "job_id",
    NULL::character varying(50) AS "status",
    NULL::timestamp with time zone AS "started_at",
    NULL::timestamp with time zone AS "completed_at",
    NULL::integer AS "duration_ms",
    NULL::boolean AS "success",
    NULL::"text" AS "error",
    NULL::integer AS "items_processed",
    NULL::integer AS "items_failed",
    NULL::integer AS "total_sites",
    NULL::integer AS "processed_sites",
    NULL::integer AS "total_batches",
    NULL::integer AS "current_batch",
    NULL::integer AS "batch_size",
    NULL::"text" AS "current_site",
    NULL::bigint AS "total_steps",
    NULL::bigint AS "successful_steps";


ALTER TABLE "public"."admin_activity_logs" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."content_book" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "image_path" "text",
    "link" "text" NOT NULL,
    "date_created" timestamp with time zone NOT NULL,
    "date_published" timestamp with time zone,
    "free" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "authors" "text" NOT NULL,
    "publisher" "text" NOT NULL,
    "summary" "text",
    "body" "text"
);


ALTER TABLE "public"."content_book" OWNER TO "postgres";


ALTER TABLE "public"."content_book" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."content_book_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."content_book_topics" (
    "id" bigint NOT NULL,
    "book_id" bigint NOT NULL,
    "topic_id" bigint NOT NULL
);


ALTER TABLE "public"."content_book_topics" OWNER TO "postgres";


ALTER TABLE "public"."content_book_topics" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."content_book_topics_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."content_post" (
    "id" bigint NOT NULL,
    "title" character varying(1000) NOT NULL,
    "description" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "date_created" "date" NOT NULL,
    "date_published" "date",
    "link" character varying(1000) NOT NULL,
    "image_path" character varying(1000),
    "site_id" bigint,
    "content" "text",
    "status" character varying(11) NOT NULL,
    "tags_list" "text",
    "indexed" boolean NOT NULL,
    "slug" "text",
    "user_id" bigint
);


ALTER TABLE "public"."content_post" OWNER TO "postgres";


ALTER TABLE "public"."content_post" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."content_post_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."content_post_topics" (
    "post_id" integer NOT NULL,
    "topic_id" integer NOT NULL,
    "id" bigint NOT NULL
);


ALTER TABLE "public"."content_post_topics" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."content_post_topics_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."content_post_topics_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."content_post_topics_id_seq" OWNED BY "public"."content_post_topics"."id";



CREATE TABLE IF NOT EXISTS "public"."content_site" (
    "id" bigint NOT NULL,
    "title" character varying(1000) NOT NULL,
    "description" "text",
    "content" "text",
    "url" character varying(200) NOT NULL,
    "status" character varying(1) NOT NULL,
    "feed_url" character varying(200),
    "site_icon" character varying(255),
    "slug" character varying(200) NOT NULL,
    "include_in_newsfeed" boolean NOT NULL,
    "user_id" bigint
);


ALTER TABLE "public"."content_site" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_site_site_type" (
    "id" integer NOT NULL,
    "site_id" bigint NOT NULL,
    "sitetype_id" bigint NOT NULL
);


ALTER TABLE "public"."content_site_site_type" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_sitetype" (
    "id" bigint NOT NULL,
    "name" character varying(500) NOT NULL,
    "slug" character varying(50) NOT NULL
);


ALTER TABLE "public"."content_sitetype" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_tool" (
    "id" bigint NOT NULL,
    "title" character varying(600) NOT NULL,
    "description" "text" NOT NULL,
    "link" character varying(200) NOT NULL,
    "image" character varying(255) NOT NULL,
    "date" "date" NOT NULL,
    "body" "text",
    "slug" character varying(50) NOT NULL,
    "status" character varying(11) NOT NULL,
    "user_id" bigint
);


ALTER TABLE "public"."content_tool" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_tool_topics" (
    "id" integer NOT NULL,
    "tool_id" bigint NOT NULL,
    "topic_id" bigint NOT NULL
);


ALTER TABLE "public"."content_tool_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_topic" (
    "id" bigint NOT NULL,
    "name" character varying(500) NOT NULL,
    "slug" character varying(50) NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."content_topic" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_user_topics" (
    "id" bigint NOT NULL,
    "user_profile_id" bigint NOT NULL,
    "topic_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."content_user_topics" OWNER TO "postgres";


ALTER TABLE "public"."content_user_topics" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."content_user_topics_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."edge_function_logs" (
    "id" bigint NOT NULL,
    "function_name" character varying(100) NOT NULL,
    "execution_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" bigint,
    "status" character varying(50) NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "success" boolean,
    "error" "text",
    "items_processed" integer DEFAULT 0,
    "items_failed" integer DEFAULT 0,
    "memory_used_mb" double precision,
    "context" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."edge_function_logs" OWNER TO "postgres";


ALTER TABLE "public"."edge_function_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."edge_function_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."edge_function_steps" (
    "id" bigint NOT NULL,
    "log_id" bigint,
    "step_name" character varying(100) NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "success" boolean,
    "message" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."edge_function_steps" OWNER TO "postgres";


ALTER TABLE "public"."edge_function_steps" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."edge_function_steps_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."feed_processing_events" (
    "id" bigint NOT NULL,
    "job_id" bigint,
    "event_type" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."feed_processing_events" OWNER TO "postgres";


ALTER TABLE "public"."feed_processing_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."feed_processing_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."feed_processing_jobs" (
    "id" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_sites" integer DEFAULT 0 NOT NULL,
    "processed_sites" integer DEFAULT 0 NOT NULL,
    "processed_items" integer DEFAULT 0 NOT NULL,
    "error_count" integer DEFAULT 0 NOT NULL,
    "current_site" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_by" "uuid" NOT NULL,
    "completed_at" timestamp with time zone,
    "error" "text",
    "is_cron" boolean DEFAULT false,
    "started_at" timestamp with time zone,
    "last_updated" timestamp with time zone,
    "duration" integer,
    "job_type" character varying(50) DEFAULT 'feed_processing'::character varying NOT NULL,
    "current_batch" integer DEFAULT 0,
    "total_batches" integer DEFAULT 1,
    "batch_size" integer DEFAULT 10,
    "last_processed_site_id" integer,
    "last_processed_item_id" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."feed_processing_jobs" OWNER TO "postgres";


ALTER TABLE "public"."feed_processing_jobs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."feed_processing_jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."newsletter_posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "beehiiv_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" NOT NULL,
    "authors" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "publish_date" timestamp with time zone NOT NULL,
    "displayed_date" timestamp with time zone NOT NULL,
    "web_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "slug" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "preview_text" "text",
    "meta_default_title" "text",
    "meta_default_description" "text",
    "stats" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."newsletter_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_history" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "query" "text" NOT NULL,
    "summary" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "total_results" integer
);


ALTER TABLE "public"."search_history" OWNER TO "postgres";


ALTER TABLE "public"."search_history" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."search_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "username" "text" NOT NULL,
    "name" "text",
    "is_admin" boolean DEFAULT false NOT NULL,
    "image_url" "text",
    "newsletter_subscriber" boolean DEFAULT false,
    "website" "text",
    "linkedin" "text",
    "bluesky" "text",
    "biography" "text",
    "role" "text",
    "newsletter_pending" boolean DEFAULT false
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE "public"."user_profiles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_profiles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."content_post_topics" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."content_post_topics_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."content_book"
    ADD CONSTRAINT "content_book_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_book_topics"
    ADD CONSTRAINT "content_book_topics_book_id_topic_id_key" UNIQUE ("book_id", "topic_id");



ALTER TABLE ONLY "public"."content_book_topics"
    ADD CONSTRAINT "content_book_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_post"
    ADD CONSTRAINT "content_post_link_unique" UNIQUE ("link");



ALTER TABLE ONLY "public"."content_post"
    ADD CONSTRAINT "content_post_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_post"
    ADD CONSTRAINT "content_post_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."content_post_topics"
    ADD CONSTRAINT "content_post_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_site"
    ADD CONSTRAINT "content_site_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_site_site_type"
    ADD CONSTRAINT "content_site_site_type_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_sitetype"
    ADD CONSTRAINT "content_sitetype_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_tool"
    ADD CONSTRAINT "content_tool_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_tool_topics"
    ADD CONSTRAINT "content_tool_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_topic"
    ADD CONSTRAINT "content_topic_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_user_topics"
    ADD CONSTRAINT "content_user_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_user_topics"
    ADD CONSTRAINT "content_user_topics_user_profile_id_topic_id_key" UNIQUE ("user_profile_id", "topic_id");



ALTER TABLE ONLY "public"."edge_function_logs"
    ADD CONSTRAINT "edge_function_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edge_function_steps"
    ADD CONSTRAINT "edge_function_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_processing_events"
    ADD CONSTRAINT "feed_processing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_processing_jobs"
    ADD CONSTRAINT "feed_processing_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_posts"
    ADD CONSTRAINT "newsletter_posts_beehiiv_id_key" UNIQUE ("beehiiv_id");



ALTER TABLE ONLY "public"."newsletter_posts"
    ADD CONSTRAINT "newsletter_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_history"
    ADD CONSTRAINT "search_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_post_topics"
    ADD CONSTRAINT "unique_post_topic" UNIQUE ("post_id", "topic_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_username_key" UNIQUE ("username");



CREATE INDEX "content_book_title_idx" ON "public"."content_book" USING "btree" ("title");



CREATE INDEX "content_book_topics_book_id_idx" ON "public"."content_book_topics" USING "btree" ("book_id");



CREATE INDEX "content_book_topics_topic_id_idx" ON "public"."content_book_topics" USING "btree" ("topic_id");



CREATE INDEX "content_post_link_idx" ON "public"."content_post" USING "btree" ("link");



CREATE INDEX "content_post_site_id_c4b7e0fa" ON "public"."content_post" USING "btree" ("site_id");



CREATE INDEX "content_post_site_id_idx" ON "public"."content_post" USING "btree" ("site_id");



CREATE INDEX "content_post_status_idx" ON "public"."content_post" USING "btree" ("status");



CREATE INDEX "content_site_site_type_site_id_92f1a257" ON "public"."content_site_site_type" USING "btree" ("site_id");



CREATE UNIQUE INDEX "content_site_site_type_site_id_sitetype_id_964ada47_uniq" ON "public"."content_site_site_type" USING "btree" ("site_id", "sitetype_id");



CREATE INDEX "content_site_site_type_sitetype_id_62336507" ON "public"."content_site_site_type" USING "btree" ("sitetype_id");



CREATE INDEX "content_site_slug_c5f498f5_like" ON "public"."content_site" USING "btree" ("slug" "varchar_pattern_ops");



CREATE UNIQUE INDEX "content_site_slug_key" ON "public"."content_site" USING "btree" ("slug");



CREATE INDEX "content_sitetype_slug_c6cfd202_like" ON "public"."content_sitetype" USING "btree" ("slug" "varchar_pattern_ops");



CREATE UNIQUE INDEX "content_sitetype_slug_key" ON "public"."content_sitetype" USING "btree" ("slug");



CREATE INDEX "content_tool_slug_e30686bb_like" ON "public"."content_tool" USING "btree" ("slug" "varchar_pattern_ops");



CREATE UNIQUE INDEX "content_tool_slug_key" ON "public"."content_tool" USING "btree" ("slug");



CREATE INDEX "content_tool_topics_tool_id_3fd80692" ON "public"."content_tool_topics" USING "btree" ("tool_id");



CREATE UNIQUE INDEX "content_tool_topics_tool_id_topic_id_9b8e68ea_uniq" ON "public"."content_tool_topics" USING "btree" ("tool_id", "topic_id");



CREATE INDEX "content_tool_topics_topic_id_c2fa6d44" ON "public"."content_tool_topics" USING "btree" ("topic_id");



CREATE INDEX "content_topic_slug_4c821e27_like" ON "public"."content_topic" USING "btree" ("slug" "varchar_pattern_ops");



CREATE UNIQUE INDEX "content_topic_slug_key" ON "public"."content_topic" USING "btree" ("slug");



CREATE INDEX "idx_newsletter_posts_beehiiv_id" ON "public"."newsletter_posts" USING "btree" ("beehiiv_id");



CREATE INDEX "search_history_created_at_idx" ON "public"."search_history" USING "btree" ("created_at");



CREATE INDEX "search_history_user_id_idx" ON "public"."search_history" USING "btree" ("user_id");



CREATE OR REPLACE VIEW "public"."admin_activity_logs" AS
 SELECT "l"."id",
    "l"."function_name",
    "l"."execution_id",
    "l"."job_id",
    "l"."status",
    "l"."started_at",
    "l"."completed_at",
    "l"."duration_ms",
    "l"."success",
    "l"."error",
    "l"."items_processed",
    "l"."items_failed",
    "j"."total_sites",
    "j"."processed_sites",
    "j"."total_batches",
    "j"."current_batch",
    "j"."batch_size",
    "j"."current_site",
    "count"("s"."id") AS "total_steps",
    "sum"(
        CASE
            WHEN ("s"."success" = true) THEN 1
            ELSE 0
        END) AS "successful_steps"
   FROM (("public"."edge_function_logs" "l"
     LEFT JOIN "public"."feed_processing_jobs" "j" ON (("l"."job_id" = "j"."id")))
     LEFT JOIN "public"."edge_function_steps" "s" ON (("s"."log_id" = "l"."id")))
  GROUP BY "l"."id", "j"."id"
  ORDER BY "l"."started_at" DESC;



CREATE OR REPLACE TRIGGER "set_content_post_slug" BEFORE INSERT ON "public"."content_post" FOR EACH ROW EXECUTE FUNCTION "public"."set_slug_on_content_post"();



CREATE OR REPLACE TRIGGER "update_newsletter_posts_updated_at" BEFORE UPDATE ON "public"."newsletter_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_newsletter_posts_updated_at"();



ALTER TABLE ONLY "public"."content_book_topics"
    ADD CONSTRAINT "content_book_topics_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."content_book"("id");



ALTER TABLE ONLY "public"."content_book_topics"
    ADD CONSTRAINT "content_book_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."content_topic"("id");



ALTER TABLE ONLY "public"."content_post"
    ADD CONSTRAINT "content_post_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."content_site"("id");



ALTER TABLE ONLY "public"."content_post_topics"
    ADD CONSTRAINT "content_post_topics_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."content_post"("id");



ALTER TABLE ONLY "public"."content_post_topics"
    ADD CONSTRAINT "content_post_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."content_topic"("id");



ALTER TABLE ONLY "public"."content_post"
    ADD CONSTRAINT "content_post_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."content_site_site_type"
    ADD CONSTRAINT "content_site_site_type_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."content_site"("id");



ALTER TABLE ONLY "public"."content_site_site_type"
    ADD CONSTRAINT "content_site_site_type_sitetype_id_fkey" FOREIGN KEY ("sitetype_id") REFERENCES "public"."content_sitetype"("id");



ALTER TABLE ONLY "public"."content_site"
    ADD CONSTRAINT "content_site_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."content_tool_topics"
    ADD CONSTRAINT "content_tool_topics_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "public"."content_tool"("id");



ALTER TABLE ONLY "public"."content_tool_topics"
    ADD CONSTRAINT "content_tool_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."content_topic"("id");



ALTER TABLE ONLY "public"."content_tool"
    ADD CONSTRAINT "content_tool_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."content_user_topics"
    ADD CONSTRAINT "content_user_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."content_topic"("id");



ALTER TABLE ONLY "public"."content_user_topics"
    ADD CONSTRAINT "content_user_topics_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."edge_function_logs"
    ADD CONSTRAINT "edge_function_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."feed_processing_jobs"("id");



ALTER TABLE ONLY "public"."edge_function_steps"
    ADD CONSTRAINT "edge_function_steps_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "public"."edge_function_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_processing_events"
    ADD CONSTRAINT "feed_processing_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."feed_processing_jobs"("id");



ALTER TABLE ONLY "public"."feed_processing_jobs"
    ADD CONSTRAINT "feed_processing_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."search_history"
    ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Allow full access to admins" ON "public"."edge_function_logs" USING (( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Allow full access to admins" ON "public"."edge_function_steps" USING (( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Allow full access to admins" ON "public"."feed_processing_events" USING (( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Allow service role access" ON "public"."edge_function_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role access" ON "public"."edge_function_steps" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role access" ON "public"."feed_processing_events" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Enable delete for users based on user_id and status" ON "public"."content_post" FOR DELETE TO "authenticated" USING (((("user_id" = ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))) AND (("status")::"text" = 'draft'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admin users" ON "public"."search_history" USING (("auth"."uid"() IN ( SELECT "user_profiles"."user_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."is_admin" = true))));



CREATE POLICY "Enable full access for admins" ON "public"."content_book" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admins" ON "public"."content_post" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admins" ON "public"."content_site" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admins" ON "public"."content_tool" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admins and service role" ON "public"."content_book_topics" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admins and service role" ON "public"."content_post_topics" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admins and service role" ON "public"."content_tool_topics" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admins and service role" ON "public"."content_topic" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admins and service role" ON "public"."newsletter_posts" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable insert for anonymous searches" ON "public"."search_history" FOR INSERT WITH CHECK (("user_id" IS NULL));



CREATE POLICY "Enable insert for authenticated users" ON "public"."content_post" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))) AND (("status")::"text" = 'draft'::"text")));



CREATE POLICY "Enable insert for authenticated users" ON "public"."feed_processing_jobs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users" ON "public"."search_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable read access for all users" ON "public"."content_book" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_book_topics" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_post" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_post_topics" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_site" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_site_site_type" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_sitetype" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_tool" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_tool_topics" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_topic" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."content_user_topics" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."newsletter_posts" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."feed_processing_jobs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for users own searches" ON "public"."search_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable update for authenticated users" ON "public"."feed_processing_jobs" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable update for users based on user_id" ON "public"."content_post" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK ((("user_id" = ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Profiles are publicly viewable" ON "public"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "Profiles are viewable by everyone" ON "public"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "Service role has full access" ON "public"."user_profiles" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Users can create their own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE ("user_profiles_1"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create their own topic relationships" ON "public"."content_user_topics" FOR INSERT TO "authenticated" WITH CHECK (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own profile" ON "public"."user_profiles" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own topic relationships" ON "public"."content_user_topics" FOR DELETE TO "authenticated" USING (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can read all topic relationships" ON "public"."content_user_topics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (COALESCE("is_admin", false) = COALESCE(( SELECT "user_profiles_1"."is_admin"
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE ("user_profiles_1"."user_id" = "auth"."uid"())), false))));



CREATE POLICY "Users can update their own topic relationships" ON "public"."content_user_topics" FOR UPDATE TO "authenticated" USING (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."content_book" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_book_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_post" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_post_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_site" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_site_site_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_sitetype" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_tool" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_tool_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_topic" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_user_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."edge_function_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."edge_function_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feed_processing_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feed_processing_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_unique_slug"("title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_unique_slug"("title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_unique_slug"("title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents_optimized"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents_optimized"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents_optimized"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_slug_on_content_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_slug_on_content_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_slug_on_content_post"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_statement_timeout"("milliseconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_statement_timeout"("milliseconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_statement_timeout"("milliseconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_newsletter_posts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_newsletter_posts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_newsletter_posts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";


















GRANT ALL ON TABLE "public"."admin_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."content_book" TO "anon";
GRANT ALL ON TABLE "public"."content_book" TO "authenticated";
GRANT ALL ON TABLE "public"."content_book" TO "service_role";



GRANT ALL ON SEQUENCE "public"."content_book_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."content_book_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."content_book_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."content_book_topics" TO "anon";
GRANT ALL ON TABLE "public"."content_book_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."content_book_topics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."content_book_topics_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."content_book_topics_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."content_book_topics_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."content_post" TO "anon";
GRANT ALL ON TABLE "public"."content_post" TO "authenticated";
GRANT ALL ON TABLE "public"."content_post" TO "service_role";



GRANT ALL ON SEQUENCE "public"."content_post_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."content_post_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."content_post_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."content_post_topics" TO "anon";
GRANT ALL ON TABLE "public"."content_post_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."content_post_topics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."content_post_topics_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."content_post_topics_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."content_post_topics_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."content_site" TO "anon";
GRANT ALL ON TABLE "public"."content_site" TO "authenticated";
GRANT ALL ON TABLE "public"."content_site" TO "service_role";



GRANT ALL ON TABLE "public"."content_site_site_type" TO "anon";
GRANT ALL ON TABLE "public"."content_site_site_type" TO "authenticated";
GRANT ALL ON TABLE "public"."content_site_site_type" TO "service_role";



GRANT ALL ON TABLE "public"."content_sitetype" TO "anon";
GRANT ALL ON TABLE "public"."content_sitetype" TO "authenticated";
GRANT ALL ON TABLE "public"."content_sitetype" TO "service_role";



GRANT ALL ON TABLE "public"."content_tool" TO "anon";
GRANT ALL ON TABLE "public"."content_tool" TO "authenticated";
GRANT ALL ON TABLE "public"."content_tool" TO "service_role";



GRANT ALL ON TABLE "public"."content_tool_topics" TO "anon";
GRANT ALL ON TABLE "public"."content_tool_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."content_tool_topics" TO "service_role";



GRANT ALL ON TABLE "public"."content_topic" TO "anon";
GRANT ALL ON TABLE "public"."content_topic" TO "authenticated";
GRANT ALL ON TABLE "public"."content_topic" TO "service_role";



GRANT ALL ON TABLE "public"."content_user_topics" TO "anon";
GRANT ALL ON TABLE "public"."content_user_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."content_user_topics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."content_user_topics_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."content_user_topics_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."content_user_topics_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."edge_function_logs" TO "anon";
GRANT ALL ON TABLE "public"."edge_function_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."edge_function_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."edge_function_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."edge_function_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."edge_function_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."edge_function_steps" TO "anon";
GRANT ALL ON TABLE "public"."edge_function_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."edge_function_steps" TO "service_role";



GRANT ALL ON SEQUENCE "public"."edge_function_steps_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."edge_function_steps_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."edge_function_steps_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."feed_processing_events" TO "anon";
GRANT ALL ON TABLE "public"."feed_processing_events" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_processing_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."feed_processing_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."feed_processing_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."feed_processing_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."feed_processing_jobs" TO "anon";
GRANT ALL ON TABLE "public"."feed_processing_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_processing_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."feed_processing_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."feed_processing_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."feed_processing_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_posts" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_posts" TO "service_role";



GRANT ALL ON TABLE "public"."search_history" TO "anon";
GRANT ALL ON TABLE "public"."search_history" TO "authenticated";
GRANT ALL ON TABLE "public"."search_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."search_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."search_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."search_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_profiles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_profiles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_profiles_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
