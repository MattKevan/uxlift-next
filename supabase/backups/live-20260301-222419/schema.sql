

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


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "extensions";


ALTER SCHEMA "extensions" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "graphql";


ALTER SCHEMA "graphql" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "graphql_public";


ALTER SCHEMA "graphql_public" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "pgsodium";


ALTER SCHEMA "pgsodium" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "realtime";


ALTER SCHEMA "realtime" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "supabase_migrations";


ALTER SCHEMA "supabase_migrations" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "vault";


ALTER SCHEMA "vault" OWNER TO "supabase_admin";


CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "realtime"."action" AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE "realtime"."action" OWNER TO "supabase_admin";


CREATE TYPE "realtime"."equality_op" AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


ALTER TYPE "realtime"."equality_op" OWNER TO "supabase_admin";


CREATE TYPE "realtime"."user_defined_filter" AS (
	"column_name" "text",
	"op" "realtime"."equality_op",
	"value" "text"
);


ALTER TYPE "realtime"."user_defined_filter" OWNER TO "supabase_admin";


CREATE TYPE "realtime"."wal_column" AS (
	"name" "text",
	"type_name" "text",
	"type_oid" "oid",
	"value" "jsonb",
	"is_pkey" boolean,
	"is_selectable" boolean
);


ALTER TYPE "realtime"."wal_column" OWNER TO "supabase_admin";


CREATE TYPE "realtime"."wal_rls" AS (
	"wal" "jsonb",
	"is_rls_enabled" boolean,
	"subscription_ids" "uuid"[],
	"errors" "text"[]
);


ALTER TYPE "realtime"."wal_rls" OWNER TO "supabase_admin";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_cron_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_cron_access"() OWNER TO "postgres";


COMMENT ON FUNCTION "extensions"."grant_pg_cron_access"() IS 'Grants access to pg_cron';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_graphql_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION "extensions"."grant_pg_graphql_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_graphql_access"() IS 'Grants access to pg_graphql';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_net_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_event_trigger_ddl_commands() AS ev
      JOIN pg_extension AS ext
      ON ev.objid = ext.oid
      WHERE ext.extname = 'pg_net'
    )
    THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'supabase_functions_admin'
      )
      THEN
        CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
      END IF;

      GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

      IF EXISTS (
        SELECT FROM pg_extension
        WHERE extname = 'pg_net'
        -- all versions in use on existing projects as of 2025-02-20
        -- version 0.12.0 onwards don't need these applied
        AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8.0', '0.10.0', '0.11.0')
      ) THEN
        ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
        ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

        ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
        ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

        REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
        REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

        GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
        GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      END IF;
    END IF;
  END;
  $$;


ALTER FUNCTION "extensions"."grant_pg_net_access"() OWNER TO "postgres";


COMMENT ON FUNCTION "extensions"."grant_pg_net_access"() IS 'Grants access to pg_net';



CREATE OR REPLACE FUNCTION "extensions"."pgrst_ddl_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_ddl_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."pgrst_drop_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_drop_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."set_graphql_placeholder"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION "extensions"."set_graphql_placeholder"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."set_graphql_placeholder"() IS 'Reintroduces placeholder function for graphql_public.graphql';



CREATE OR REPLACE FUNCTION "public"."check_job_completion"("job_id_param" bigint) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  all_completed BOOLEAN;
  total_batches INTEGER;
  completed_batches INTEGER;
BEGIN
  -- Count all batches and completed batches
  SELECT 
    COUNT(*) = SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
    COUNT(*),
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)
  INTO 
    all_completed, total_batches, completed_batches
  FROM 
    feed_processing_batches
  WHERE 
    job_id = job_id_param;
  
  -- If all batches are completed, mark the job as completed
  IF all_completed AND total_batches > 0 THEN
    UPDATE feed_processing_jobs
    SET 
      status = 'completed',
      completed_at = NOW(),
      last_updated = NOW()
    WHERE 
      id = job_id_param AND status = 'processing';
    
    -- Log the completion
    INSERT INTO detailed_logs (
      timestamp,
      function_name,
      execution_id,
      level,
      message,
      job_id,
      metadata
    ) VALUES (
      NOW(),
      'job_completion_check',
      gen_random_uuid()::text,
      'info',
      'Job marked as completed',
      job_id_param,
      json_build_object(
        'total_batches', total_batches,
        'completed_batches', completed_batches
      )
    );
    
    -- Create a job completion event
    INSERT INTO feed_processing_events (
      job_id,
      event_type,
      created_at,
      payload,
      processed
    ) VALUES (
      job_id_param,
      'job_completed',
      NOW(),
      json_build_object(
        'completion_time', NOW()
      ),
      false
    );
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."check_job_completion"("job_id_param" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_job_completion_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    PERFORM check_job_completion(NEW.job_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_job_completion_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_stalled_batches"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Mark batches as failed if they've been processing for more than 30 minutes
  WITH updated AS (
    UPDATE feed_processing_batches
    SET 
      status = 'failed',
      error = 'Batch stalled (no updates for 30+ minutes)',
      last_updated = NOW()
    WHERE 
      status = 'processing'
      AND started_at < NOW() - INTERVAL '30 minutes'
    RETURNING id, job_id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  
  -- Create a notification for each stalled batch
  IF updated_count > 0 THEN
    -- Log the cleanup action
    INSERT INTO detailed_logs (
      timestamp,
      function_name,
      execution_id,
      level,
      message,
      metadata
    ) VALUES (
      NOW(),
      'cleanup_function',
      gen_random_uuid()::text,
      'warning',
      'Cleaned up stalled batches',
      json_build_object('count', updated_count)
    );
  END IF;
  
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_stalled_batches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_unique_slug"("title" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."is_admin_user"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND is_admin = true
  );
$$;


ALTER FUNCTION "public"."is_admin_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.5, "match_count" integer DEFAULT 10) RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."notify_batch_ready"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Emit notification to any listening services
  PERFORM pg_notify(
    'feed_batch_ready',
    json_build_object(
      'job_id', NEW.job_id,
      'batch_id', NEW.id,
      'batch_number', NEW.batch_number
    )::text
  );
  
  -- Also log this in our detailed_logs table
  INSERT INTO detailed_logs (
    timestamp,
    function_name,
    execution_id,
    level,
    message,
    job_id,
    metadata
  ) VALUES (
    NOW(),
    'database_trigger',
    gen_random_uuid()::text,
    'info',
    'Batch ready notification sent',
    NEW.job_id,
    json_build_object(
      'batch_id', NEW.id,
      'batch_number', NEW.batch_number
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_batch_ready"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_slug_on_content_post"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  execute format('set local statement_timeout = %s', milliseconds);
end;
$$;


ALTER FUNCTION "public"."set_statement_timeout"("milliseconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_newsletter_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


ALTER FUNCTION "public"."update_newsletter_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer DEFAULT (1024 * 1024)) RETURNS SETOF "realtime"."wal_rls"
    LANGUAGE "plpgsql"
    AS $$
declare
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

columns realtime.wal_column[];
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."broadcast_changes"("topic_name" "text", "event_name" "text", "operation" "text", "table_name" "text", "table_schema" "text", "new" "record", "old" "record", "level" "text" DEFAULT 'ROW'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION "realtime"."broadcast_changes"("topic_name" "text", "event_name" "text", "operation" "text", "table_name" "text", "table_schema" "text", "new" "record", "old" "record", "level" "text") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) RETURNS "text"
    LANGUAGE "sql"
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


ALTER FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


ALTER FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


ALTER FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) RETURNS SETOF "realtime"."wal_rls"
    LANGUAGE "sql"
    SET "log_min_messages" TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


ALTER FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."quote_wal2json"("entity" "regclass") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


ALTER FUNCTION "realtime"."quote_wal2json"("entity" "regclass") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."send"("payload" "jsonb", "event" "text", "topic" "text", "private" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION "realtime"."send"("payload" "jsonb", "event" "text", "topic" "text", "private" boolean) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."subscription_check_filters"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


ALTER FUNCTION "realtime"."subscription_check_filters"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."to_regrole"("role_name" "text") RETURNS "regrole"
    LANGUAGE "sql" IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION "realtime"."to_regrole"("role_name" "text") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."topic"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION "realtime"."topic"() OWNER TO "supabase_realtime_admin";


CREATE OR REPLACE FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


ALTER FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix_hierarchy_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix_hierarchy_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_level"("name" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION "storage"."get_level"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefix"("name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


ALTER FUNCTION "storage"."get_prefix"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefixes"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


ALTER FUNCTION "storage"."get_prefixes"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


ALTER FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_insert_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_insert_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_update_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_level_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_level_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."prefixes_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_insert_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."prefixes_insert_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "vault"."secrets_encrypt_secret_secret"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
		BEGIN
		        new.secret = CASE WHEN new.secret IS NULL THEN NULL ELSE
			CASE WHEN new.key_id IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.secret, 'utf8'),
				pg_catalog.convert_to((new.id::text || new.description::text || new.created_at::text || new.updated_at::text)::text, 'utf8'),
				new.key_id::uuid,
				new.nonce
			  ),
				'base64') END END;
		RETURN new;
		END;
		$$;


ALTER FUNCTION "vault"."secrets_encrypt_secret_secret"() OWNER TO "supabase_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" "json",
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "code_challenge" "text",
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone,
    "invite_token" "text",
    "referrer" "text",
    "oauth_client_state_id" "uuid",
    "linking_target_id" "uuid",
    "email_optional" boolean DEFAULT false NOT NULL
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'Stores metadata for all OAuth/SSO login flows';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "auth"."oauth_client_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';



CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    "token_endpoint_auth_method" "text" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048)),
    CONSTRAINT "oauth_clients_token_endpoint_auth_method_check" CHECK (("token_endpoint_auth_method" = ANY (ARRAY['client_secret_basic'::"text", 'client_secret_post'::"text", 'none'::"text"])))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



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


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


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
    "user_id" bigint,
    "bluesky_posted" boolean DEFAULT false,
    "bluesky_posted_at" timestamp with time zone
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



CREATE TABLE IF NOT EXISTS "public"."detailed_logs" (
    "id" bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "function_name" "text" NOT NULL,
    "execution_id" "text" NOT NULL,
    "level" "text" NOT NULL,
    "message" "text" NOT NULL,
    "job_id" bigint,
    "step" "text",
    "metadata" "jsonb",
    "error" "jsonb"
);


ALTER TABLE "public"."detailed_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."detailed_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."detailed_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."detailed_logs_id_seq" OWNED BY "public"."detailed_logs"."id";



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



CREATE TABLE IF NOT EXISTS "public"."feed_processing_batches" (
    "id" bigint NOT NULL,
    "job_id" bigint,
    "batch_number" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "continuation" boolean DEFAULT false NOT NULL,
    "previous_batch_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "last_updated" timestamp with time zone,
    "items_processed" integer DEFAULT 0 NOT NULL,
    "error_count" integer DEFAULT 0 NOT NULL,
    "current_site" "text",
    "error" "text",
    "state" "jsonb"
);


ALTER TABLE "public"."feed_processing_batches" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."feed_processing_batches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."feed_processing_batches_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."feed_processing_batches_id_seq" OWNED BY "public"."feed_processing_batches"."id";



CREATE TABLE IF NOT EXISTS "public"."feed_processing_events" (
    "id" bigint NOT NULL,
    "job_id" bigint,
    "event_type" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "batch_id" bigint
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
    "created_by" "uuid",
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



CREATE TABLE IF NOT EXISTS "realtime"."messages" (
    "topic" "text" NOT NULL,
    "extension" "text" NOT NULL,
    "payload" "jsonb",
    "event" "text",
    "private" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "inserted_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
)
PARTITION BY RANGE ("inserted_at");


ALTER TABLE "realtime"."messages" OWNER TO "supabase_realtime_admin";


CREATE TABLE IF NOT EXISTS "realtime"."schema_migrations" (
    "version" bigint NOT NULL,
    "inserted_at" timestamp(0) without time zone
);


ALTER TABLE "realtime"."schema_migrations" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "realtime"."subscription" (
    "id" bigint NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "entity" "regclass" NOT NULL,
    "filters" "realtime"."user_defined_filter"[] DEFAULT '{}'::"realtime"."user_defined_filter"[] NOT NULL,
    "claims" "jsonb" NOT NULL,
    "claims_role" "regrole" GENERATED ALWAYS AS ("realtime"."to_regrole"(("claims" ->> 'role'::"text"))) STORED NOT NULL,
    "created_at" timestamp without time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "realtime"."subscription" OWNER TO "supabase_admin";


ALTER TABLE "realtime"."subscription" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "realtime"."subscription_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb",
    "level" integer
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."prefixes" (
    "bucket_id" "text" NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "level" integer GENERATED ALWAYS AS ("storage"."get_level"("name")) STORED NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "storage"."prefixes" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "supabase_migrations"."schema_migrations" (
    "version" "text" NOT NULL,
    "statements" "text"[],
    "name" "text"
);


ALTER TABLE "supabase_migrations"."schema_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "supabase_migrations"."seed_files" (
    "path" "text" NOT NULL,
    "hash" "text" NOT NULL
);


ALTER TABLE "supabase_migrations"."seed_files" OWNER TO "postgres";


CREATE OR REPLACE VIEW "vault"."decrypted_secrets" AS
 SELECT "secrets"."id",
    "secrets"."name",
    "secrets"."description",
    "secrets"."secret",
        CASE
            WHEN ("secrets"."secret" IS NULL) THEN NULL::"text"
            ELSE
            CASE
                WHEN ("secrets"."key_id" IS NULL) THEN NULL::"text"
                ELSE "convert_from"("pgsodium"."crypto_aead_det_decrypt"("decode"("secrets"."secret", 'base64'::"text"), "convert_to"((((("secrets"."id")::"text" || "secrets"."description") || ("secrets"."created_at")::"text") || ("secrets"."updated_at")::"text"), 'utf8'::"name"), "secrets"."key_id", "secrets"."nonce"), 'utf8'::"name")
            END
        END AS "decrypted_secret",
    "secrets"."key_id",
    "secrets"."nonce",
    "secrets"."created_at",
    "secrets"."updated_at"
   FROM "vault"."secrets";


ALTER TABLE "vault"."decrypted_secrets" OWNER TO "supabase_admin";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."content_post_topics" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."content_post_topics_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."detailed_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."detailed_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."feed_processing_batches" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."feed_processing_batches_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



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



ALTER TABLE ONLY "public"."detailed_logs"
    ADD CONSTRAINT "detailed_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edge_function_logs"
    ADD CONSTRAINT "edge_function_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edge_function_steps"
    ADD CONSTRAINT "edge_function_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_processing_batches"
    ADD CONSTRAINT "feed_processing_batches_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "realtime"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id", "inserted_at");



ALTER TABLE ONLY "realtime"."subscription"
    ADD CONSTRAINT "pk_subscription" PRIMARY KEY ("id");



ALTER TABLE ONLY "realtime"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."prefixes"
    ADD CONSTRAINT "prefixes_pkey" PRIMARY KEY ("bucket_id", "level", "name");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "supabase_migrations"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "supabase_migrations"."seed_files"
    ADD CONSTRAINT "seed_files_pkey" PRIMARY KEY ("path");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



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



CREATE INDEX "idx_batches_job_id" ON "public"."feed_processing_batches" USING "btree" ("job_id");



CREATE INDEX "idx_batches_status" ON "public"."feed_processing_batches" USING "btree" ("status");



CREATE INDEX "idx_content_book_topics_book_id" ON "public"."content_book_topics" USING "btree" ("book_id");



CREATE INDEX "idx_content_book_topics_topic_id" ON "public"."content_book_topics" USING "btree" ("topic_id");



CREATE INDEX "idx_content_post_indexed" ON "public"."content_post" USING "btree" ("indexed") WHERE ("indexed" = false);



CREATE INDEX "idx_content_post_link" ON "public"."content_post" USING "btree" ("link");



CREATE INDEX "idx_content_post_site_id" ON "public"."content_post" USING "btree" ("site_id") WHERE ("site_id" IS NOT NULL);



CREATE INDEX "idx_content_post_status_date_published" ON "public"."content_post" USING "btree" ("status", "date_published" DESC) WHERE (("status")::"text" = 'published'::"text");



CREATE INDEX "idx_content_post_topics_post_id" ON "public"."content_post_topics" USING "btree" ("post_id");



CREATE INDEX "idx_content_post_topics_topic_id" ON "public"."content_post_topics" USING "btree" ("topic_id");



CREATE INDEX "idx_content_post_user_id" ON "public"."content_post" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_content_site_include_in_newsfeed" ON "public"."content_site" USING "btree" ("include_in_newsfeed", "feed_url") WHERE (("include_in_newsfeed" = true) AND ("feed_url" IS NOT NULL));



CREATE INDEX "idx_content_site_site_type_site_id" ON "public"."content_site_site_type" USING "btree" ("site_id");



CREATE INDEX "idx_content_site_site_type_sitetype_id" ON "public"."content_site_site_type" USING "btree" ("sitetype_id");



CREATE INDEX "idx_content_site_user_id" ON "public"."content_site" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_content_tool_topics_tool_id" ON "public"."content_tool_topics" USING "btree" ("tool_id");



CREATE INDEX "idx_content_tool_topics_topic_id" ON "public"."content_tool_topics" USING "btree" ("topic_id");



CREATE INDEX "idx_content_tool_user_id" ON "public"."content_tool" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_content_user_topics_topic_id" ON "public"."content_user_topics" USING "btree" ("topic_id");



CREATE INDEX "idx_content_user_topics_user_profile_id" ON "public"."content_user_topics" USING "btree" ("user_profile_id");



CREATE INDEX "idx_detailed_logs_execution_id" ON "public"."detailed_logs" USING "btree" ("execution_id");



CREATE INDEX "idx_detailed_logs_job_id" ON "public"."detailed_logs" USING "btree" ("job_id");



CREATE INDEX "idx_detailed_logs_level" ON "public"."detailed_logs" USING "btree" ("level");



CREATE INDEX "idx_edge_function_logs_job_id" ON "public"."edge_function_logs" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);



CREATE INDEX "idx_edge_function_steps_log_id" ON "public"."edge_function_steps" USING "btree" ("log_id") WHERE ("log_id" IS NOT NULL);



CREATE INDEX "idx_feed_processing_batches_job_id" ON "public"."feed_processing_batches" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);



CREATE INDEX "idx_feed_processing_batches_previous_batch_id" ON "public"."feed_processing_batches" USING "btree" ("previous_batch_id") WHERE ("previous_batch_id" IS NOT NULL);



CREATE INDEX "idx_feed_processing_batches_status" ON "public"."feed_processing_batches" USING "btree" ("status");



CREATE INDEX "idx_feed_processing_events_batch_id" ON "public"."feed_processing_events" USING "btree" ("batch_id") WHERE ("batch_id" IS NOT NULL);



CREATE INDEX "idx_feed_processing_events_job_id" ON "public"."feed_processing_events" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);



CREATE INDEX "idx_feed_processing_jobs_status_created_at" ON "public"."feed_processing_jobs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_newsletter_posts_beehiiv_id" ON "public"."newsletter_posts" USING "btree" ("beehiiv_id");



CREATE INDEX "idx_search_history_user_id_created_at" ON "public"."search_history" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "search_history_created_at_idx" ON "public"."search_history" USING "btree" ("created_at");



CREATE INDEX "search_history_user_id_idx" ON "public"."search_history" USING "btree" ("user_id");



CREATE INDEX "ix_realtime_subscription_entity" ON "realtime"."subscription" USING "btree" ("entity");



CREATE INDEX "messages_inserted_at_topic_index" ON ONLY "realtime"."messages" USING "btree" ("inserted_at" DESC, "topic") WHERE (("extension" = 'broadcast'::"text") AND ("private" IS TRUE));



CREATE UNIQUE INDEX "subscription_subscription_id_entity_filters_key" ON "realtime"."subscription" USING "btree" ("subscription_id", "entity", "filters");



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE UNIQUE INDEX "idx_name_bucket_level_unique" ON "storage"."objects" USING "btree" ("name" COLLATE "C", "bucket_id", "level");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_lower_name" ON "storage"."objects" USING "btree" (("path_tokens"["level"]), "lower"("name") "text_pattern_ops", "bucket_id", "level");



CREATE INDEX "idx_prefixes_lower_name" ON "storage"."prefixes" USING "btree" ("bucket_id", "level", (("string_to_array"("name", '/'::"text"))["level"]), "lower"("name") "text_pattern_ops");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "objects_bucket_id_level_idx" ON "storage"."objects" USING "btree" ("bucket_id", "level", "name" COLLATE "C");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE OR REPLACE VIEW "public"."admin_activity_logs" WITH ("security_invoker"='on') AS
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



CREATE OR REPLACE TRIGGER "trigger_check_job_completion" AFTER UPDATE ON "public"."feed_processing_batches" FOR EACH ROW WHEN ((("new"."status" = 'completed'::"text") AND ("old"."status" <> 'completed'::"text"))) EXECUTE FUNCTION "public"."check_job_completion_trigger"();



CREATE OR REPLACE TRIGGER "trigger_notify_batch_ready" AFTER INSERT ON "public"."feed_processing_batches" FOR EACH ROW WHEN (("new"."status" = 'pending'::"text")) EXECUTE FUNCTION "public"."notify_batch_ready"();



CREATE OR REPLACE TRIGGER "update_newsletter_posts_updated_at" BEFORE UPDATE ON "public"."newsletter_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_newsletter_posts_updated_at"();



CREATE OR REPLACE TRIGGER "tr_check_filters" BEFORE INSERT OR UPDATE ON "realtime"."subscription" FOR EACH ROW EXECUTE FUNCTION "realtime"."subscription_check_filters"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "objects_delete_delete_prefix" AFTER DELETE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."delete_prefix_hierarchy_trigger"();



CREATE OR REPLACE TRIGGER "objects_insert_create_prefix" BEFORE INSERT ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."objects_insert_prefix_trigger"();



CREATE OR REPLACE TRIGGER "objects_update_create_prefix" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW WHEN ((("new"."name" <> "old"."name") OR ("new"."bucket_id" <> "old"."bucket_id"))) EXECUTE FUNCTION "storage"."objects_update_prefix_trigger"();



CREATE OR REPLACE TRIGGER "prefixes_create_hierarchy" BEFORE INSERT ON "storage"."prefixes" FOR EACH ROW WHEN (("pg_trigger_depth"() < 1)) EXECUTE FUNCTION "storage"."prefixes_insert_trigger"();



CREATE OR REPLACE TRIGGER "prefixes_delete_hierarchy" AFTER DELETE ON "storage"."prefixes" FOR EACH ROW EXECUTE FUNCTION "storage"."delete_prefix_hierarchy_trigger"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."detailed_logs"
    ADD CONSTRAINT "detailed_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."feed_processing_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."edge_function_logs"
    ADD CONSTRAINT "edge_function_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."feed_processing_jobs"("id");



ALTER TABLE ONLY "public"."edge_function_steps"
    ADD CONSTRAINT "edge_function_steps_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "public"."edge_function_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_processing_batches"
    ADD CONSTRAINT "feed_processing_batches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."feed_processing_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_processing_batches"
    ADD CONSTRAINT "feed_processing_batches_previous_batch_id_fkey" FOREIGN KEY ("previous_batch_id") REFERENCES "public"."feed_processing_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_processing_events"
    ADD CONSTRAINT "feed_processing_events_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."feed_processing_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_processing_events"
    ADD CONSTRAINT "feed_processing_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."feed_processing_jobs"("id");



ALTER TABLE ONLY "public"."feed_processing_jobs"
    ADD CONSTRAINT "feed_processing_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."search_history"
    ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."prefixes"
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Allow admin access" ON "public"."detailed_logs" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))));



CREATE POLICY "Allow admin access" ON "public"."feed_processing_batches" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))));



CREATE POLICY "Allow full access to admins" ON "public"."edge_function_logs" USING (( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Allow full access to admins" ON "public"."edge_function_steps" USING (( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Allow full access to admins" ON "public"."feed_processing_events" USING (( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())));



CREATE POLICY "Allow service role access" ON "public"."detailed_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role access" ON "public"."edge_function_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role access" ON "public"."edge_function_steps" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role access" ON "public"."feed_processing_batches" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role access" ON "public"."feed_processing_events" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Enable delete for own topics" ON "public"."content_user_topics" FOR DELETE USING (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Enable delete for users based on user_id and status" ON "public"."content_post" FOR DELETE TO "authenticated" USING (((("user_id" = ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))) AND (("status")::"text" = 'draft'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."is_admin" = true)))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable full access for admin users" ON "public"."search_history" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."is_admin" = true)))));



CREATE POLICY "Enable full access for admins" ON "public"."content_book" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."is_admin" = true)))));



CREATE POLICY "Enable full access for admins" ON "public"."content_post" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."is_admin" = true)))));



CREATE POLICY "Enable full access for admins" ON "public"."content_site" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."is_admin" = true)))));



CREATE POLICY "Enable full access for admins" ON "public"."content_tool" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."is_admin" = true)))));



CREATE POLICY "Enable full access for admins and service role" ON "public"."content_book_topics" USING ((((( SELECT "auth"."jwt"() AS "jwt") ->> 'role'::"text") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."is_admin" = true))))));



CREATE POLICY "Enable full access for admins and service role" ON "public"."content_post_topics" USING ((((( SELECT "auth"."jwt"() AS "jwt") ->> 'role'::"text") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."is_admin" = true))))));



CREATE POLICY "Enable full access for admins and service role" ON "public"."content_tool_topics" USING ((((( SELECT "auth"."jwt"() AS "jwt") ->> 'role'::"text") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."is_admin" = true))))));



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



CREATE POLICY "Enable insert for authenticated users" ON "public"."content_user_topics" FOR INSERT WITH CHECK (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Enable insert for authenticated users" ON "public"."feed_processing_jobs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users" ON "public"."search_history" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL))));



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



CREATE POLICY "Enable read access for users own searches" ON "public"."search_history" FOR SELECT USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL) OR ((( SELECT "auth"."jwt"() AS "jwt") ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Enable select for own topics" ON "public"."content_user_topics" FOR SELECT USING (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



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



CREATE POLICY "Users can create their own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create their own topic relationships" ON "public"."content_user_topics" FOR INSERT TO "authenticated" WITH CHECK (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own profile" ON "public"."user_profiles" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own topic relationships" ON "public"."content_user_topics" FOR DELETE TO "authenticated" USING (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their own posts" ON "public"."content_post" USING (("user_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can manage their own sites" ON "public"."content_site" USING (("user_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can manage their own tools" ON "public"."content_tool" USING (("user_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can read all topic relationships" ON "public"."content_user_topics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own topic relationships" ON "public"."content_user_topics" FOR UPDATE TO "authenticated" USING (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("user_profile_id" IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own profile" ON "public"."user_profiles" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."detailed_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."edge_function_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."edge_function_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feed_processing_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feed_processing_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feed_processing_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "realtime"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."prefixes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "extensions" TO "anon";
GRANT USAGE ON SCHEMA "extensions" TO "authenticated";
GRANT USAGE ON SCHEMA "extensions" TO "service_role";
GRANT ALL ON SCHEMA "extensions" TO "dashboard_user";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "realtime" TO "postgres";
GRANT USAGE ON SCHEMA "realtime" TO "anon";
GRANT USAGE ON SCHEMA "realtime" TO "authenticated";
GRANT USAGE ON SCHEMA "realtime" TO "service_role";
GRANT ALL ON SCHEMA "realtime" TO "supabase_realtime_admin";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin";
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



REVOKE ALL ON FUNCTION "extensions"."grant_pg_cron_access"() FROM "postgres";
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "postgres" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."grant_pg_graphql_access"() TO "postgres" WITH GRANT OPTION;



REVOKE ALL ON FUNCTION "extensions"."grant_pg_net_access"() FROM "postgres";
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "postgres" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."pgrst_ddl_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."pgrst_drop_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."set_graphql_placeholder"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "public"."check_job_completion"("job_id_param" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."check_job_completion"("job_id_param" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_job_completion"("job_id_param" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_job_completion_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_job_completion_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_job_completion_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_stalled_batches"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_stalled_batches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_stalled_batches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_unique_slug"("title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_unique_slug"("title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_unique_slug"("title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents_optimized"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents_optimized"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents_optimized"("query_embedding" "public"."vector", "similarity_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_batch_ready"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_batch_ready"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_batch_ready"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_slug_on_content_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_slug_on_content_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_slug_on_content_post"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_statement_timeout"("milliseconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_statement_timeout"("milliseconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_statement_timeout"("milliseconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_newsletter_posts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_newsletter_posts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_newsletter_posts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "anon";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "service_role";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."broadcast_changes"("topic_name" "text", "event_name" "text", "operation" "text", "table_name" "text", "table_schema" "text", "new" "record", "old" "record", "level" "text") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."broadcast_changes"("topic_name" "text", "event_name" "text", "operation" "text", "table_name" "text", "table_schema" "text", "new" "record", "old" "record", "level" "text") TO "dashboard_user";



GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "anon";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "service_role";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "anon";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "service_role";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "anon";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "service_role";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "anon";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "service_role";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) TO "anon";
GRANT ALL ON FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) TO "service_role";
GRANT ALL ON FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "anon";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "service_role";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."send"("payload" "jsonb", "event" "text", "topic" "text", "private" boolean) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."send"("payload" "jsonb", "event" "text", "topic" "text", "private" boolean) TO "dashboard_user";



GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "postgres";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "anon";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "service_role";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."topic"() TO "postgres";
GRANT ALL ON FUNCTION "realtime"."topic"() TO "dashboard_user";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "public"."admin_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



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



GRANT ALL ON TABLE "public"."detailed_logs" TO "anon";
GRANT ALL ON TABLE "public"."detailed_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."detailed_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."detailed_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."detailed_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."detailed_logs_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."feed_processing_batches" TO "anon";
GRANT ALL ON TABLE "public"."feed_processing_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_processing_batches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."feed_processing_batches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."feed_processing_batches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."feed_processing_batches_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "realtime"."messages" TO "postgres";
GRANT ALL ON TABLE "realtime"."messages" TO "dashboard_user";
GRANT SELECT,INSERT,UPDATE ON TABLE "realtime"."messages" TO "anon";
GRANT SELECT,INSERT,UPDATE ON TABLE "realtime"."messages" TO "authenticated";
GRANT SELECT,INSERT,UPDATE ON TABLE "realtime"."messages" TO "service_role";



GRANT ALL ON TABLE "realtime"."schema_migrations" TO "postgres";
GRANT ALL ON TABLE "realtime"."schema_migrations" TO "dashboard_user";
GRANT SELECT ON TABLE "realtime"."schema_migrations" TO "anon";
GRANT SELECT ON TABLE "realtime"."schema_migrations" TO "authenticated";
GRANT SELECT ON TABLE "realtime"."schema_migrations" TO "service_role";
GRANT ALL ON TABLE "realtime"."schema_migrations" TO "supabase_realtime_admin";



GRANT ALL ON TABLE "realtime"."subscription" TO "postgres";
GRANT ALL ON TABLE "realtime"."subscription" TO "dashboard_user";
GRANT SELECT ON TABLE "realtime"."subscription" TO "anon";
GRANT SELECT ON TABLE "realtime"."subscription" TO "authenticated";
GRANT SELECT ON TABLE "realtime"."subscription" TO "service_role";
GRANT ALL ON TABLE "realtime"."subscription" TO "supabase_realtime_admin";



GRANT ALL ON SEQUENCE "realtime"."subscription_id_seq" TO "postgres";
GRANT ALL ON SEQUENCE "realtime"."subscription_id_seq" TO "dashboard_user";
GRANT USAGE ON SEQUENCE "realtime"."subscription_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE "realtime"."subscription_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE "realtime"."subscription_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "realtime"."subscription_id_seq" TO "supabase_realtime_admin";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."prefixes" TO "service_role";
GRANT ALL ON TABLE "storage"."prefixes" TO "authenticated";
GRANT ALL ON TABLE "storage"."prefixes" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES  TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS  TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES  TO "dashboard_user";













































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















ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES  TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS  TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES  TO "service_role";



