-- Give books a URL slug so they can have detail pages at /books/<slug>/.

ALTER TABLE "public"."content_book" ADD COLUMN IF NOT EXISTS "slug" text;

CREATE OR REPLACE FUNCTION "public"."generate_unique_book_slug"("title" text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  base_slug TEXT;
  new_slug TEXT;
  counter INTEGER := 1;
BEGIN
  base_slug := unaccent(lower(title));
  base_slug := regexp_replace(base_slug, '[^a-z0-9-]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  new_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM content_book WHERE slug = new_slug) LOOP
    new_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;

  RETURN new_slug;
END;
$$;

ALTER FUNCTION "public"."generate_unique_book_slug"("title" text) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_slug_on_content_book"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_unique_book_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_slug_on_content_book"() OWNER TO "postgres";

-- Backfill existing books, oldest first so earlier titles keep the plain slug.
DO $$
DECLARE
  book RECORD;
BEGIN
  FOR book IN SELECT id, title FROM content_book WHERE slug IS NULL ORDER BY id LOOP
    UPDATE content_book SET slug = generate_unique_book_slug(book.title) WHERE id = book.id;
  END LOOP;
END;
$$;

ALTER TABLE "public"."content_book" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "content_book_slug_key" ON "public"."content_book" ("slug");

CREATE OR REPLACE TRIGGER "set_content_book_slug"
    BEFORE INSERT ON "public"."content_book"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_slug_on_content_book"();
