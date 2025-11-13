# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UX Lift is a UX design content aggregation platform built with Next.js 14+ (App Router), Supabase (PostgreSQL), and Pinecone (vector storage). It automatically ingests content via RSS feeds, processes it with AI (OpenAI), and provides RAG-based semantic search with citations.

**Key Features:**
- Automated RSS feed processing with AI summarization and tagging
- RAG search using OpenAI embeddings + Pinecone vector storage
- Integrations: Beehiiv (newsletter), Bluesky (auto-posting)
- 5500+ curated UX articles, tools, and books

## Essential Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm start                # Run production build

# Testing
npm test                 # Run Jest tests
npm run test:watch       # Watch mode for tests

# Type Generation
npm run update-types     # Generate TypeScript types from Supabase schema
                        # Project ID: nzticqypwdzqhbaestbf
```

## Architecture

### Content Processing Pipeline

The system follows a multi-stage content processing flow:

1. **RSS Ingestion** (`utils/post-tools/process-feeds.ts`)
   - Scans `content_site` table for sites with `include_in_newsfeed = true`
   - Parses RSS feeds and checks for new articles
   - Batch queries to minimize database hits

2. **Content Fetching** (`utils/post-tools/fetch-content.ts`)
   - Scrapes article URLs using Cheerio for metadata extraction
   - Uses Mozilla Readability for clean content extraction
   - Extracts: title, description, og:image, article body
   - Validates URLs and handles duplicates via unique constraint on `link`

3. **AI Processing** (executed sequentially for each new post)
   - **Summarize** (`utils/post-tools/summarise.ts`): OpenAI generates concise summary
   - **Tag** (`utils/post-tools/tag-posts.ts`): AI categorizes content into topics
   - **Embed** (`utils/post-tools/embed-post.ts`): Creates vector embeddings for search

4. **Vector Embedding** (`utils/post-tools/embed-post.ts`)
   - Uses `RecursiveCharacterTextSplitter` from LangChain to chunk content
   - Creates embeddings with OpenAI `text-embedding-3-small` (1536 dimensions)
   - Stores in Pinecone with metadata: `post_id`, `title`, `link`, `content`, `chunk_index`
   - Marks post as `indexed = true` in database

### RAG Search System

**Implementation:** [app/api/search/route.ts](app/api/search/route.ts)

Search uses a two-tier scoring approach:

1. **Strict Search** (primary)
   - `topK: 12`
   - Minimum similarity score: `0.75`

2. **Relaxed Fallback** (if strict returns no results)
   - `topK: 3`
   - Minimum similarity score: `0.6`

**Answer Generation:**
- Retrieves top matching chunks from Pinecone
- Concatenates content (max 2000 chars) for context
- Uses GPT-4o to generate contextual answer
- Logs all searches (including failures) to `search_history` table

**Rate Limiting:** Implemented via `utils/simple-rate-limit.ts` using `checkSearchRateLimit()`

### Database Schema

Key tables (see [types/supabase.ts](types/supabase.ts) for full schema):

- **`content_post`**: Main articles table
  - Fields: `id`, `title`, `description`, `content`, `link`, `image_path`, `summary`, `status`, `indexed`, `site_id`, `user_id`
  - Unique constraint on `link` to prevent duplicates

- **`content_site`**: Content sources
  - Fields: `id`, `title`, `url`, `feed_url`, `include_in_newsfeed`
  - Used to configure RSS feed sources

- **`content_topic`**: Categories/tags
  - Fields: `id`, `name`, `slug`

- **`content_post_topics`**: Junction table for post-topic relationships

- **`search_history`**: Search query logs
  - Fields: `query`, `summary`, `total_results`, `user_id` (nullable for anonymous)

- **`content_book`**: Book resources
  - Fields: `id`, `title`, `authors`, `publisher`, `link`, `free`, `status`

### API Routes

All routes are in [app/api/](app/api/):

**Content Processing:**
- `POST /api/fetch-url`: Fetch and process single URL (user submissions)
- `GET /api/process-feeds`: Process all RSS feeds (scheduled job)
- `POST /api/process-feeds-background`: Long-running feed processing
- `POST /api/summarise`: Generate AI summary for a post
- `POST /api/tag-post`: Auto-tag a post with topics
- `POST /api/embed-post`: Create vector embeddings for a post

**Batch Operations:**
- `POST /api/tag-all-posts`: Tag all untagged posts
- `POST /api/embed-all-posts`: Embed all unindexed posts
- `POST /api/reset-embeddings`: Clear and rebuild all embeddings
- `POST /api/reset-index-status`: Reset indexing status

**Search & Integration:**
- `POST /api/search`: RAG semantic search endpoint
- `POST /api/sync-newsletter`: Sync with Beehiiv newsletter
- `POST /api/trigger-github-action`: Trigger external workflows

### App Router Structure

Next.js App Router with route groups:

- **`app/(auth-pages)/`**: Authentication pages (sign-in, sign-up, confirm)
- **`app/(admin)/`**: Admin dashboard (separate layout)
- **`app/(pages)/`**: Static pages (privacy, cookies)
- **`app/articles/[slug]/`**: Dynamic article pages
- **`app/topics/[slug]/`**: Topic/category pages
- **`app/sites/[slug]/`**: Content source pages
- **`app/newsletter/[slug]/`**: Newsletter archive
- **`app/search/`**: Search interface
- **`app/tools/`**: UX tools directory

### Key Utilities

- **`utils/supabase/`**: Supabase client creation (server/client/middleware)
- **`utils/post-tools/`**: All content processing logic
- **`utils/logger.ts`**: Centralized logging utility
- **`utils/validation.ts`**: Zod schemas for API request validation
- **`utils/simple-rate-limit.ts`**: Rate limiting for API endpoints
- **`utils/env.ts`**: Environment variable validation

### Testing

Tests use Jest with React Testing Library:
- Test files: `**/*.test.ts(x)` or `**/*.spec.ts(x)`
- Setup: `jest.setup.js`
- Run single test file: `npm test -- path/to/file.test.tsx`

### Environment Variables

Required environment variables (referenced but not defined in repo):

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

**OpenAI:**
- `OPENAI_API_KEY`

**Pinecone:**
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`

**Integrations:**
- Beehiiv credentials (for newsletter sync)
- Bluesky credentials (for auto-posting)

## Important Patterns

### Content Processing Flow
When adding new content features, follow the established pipeline:
1. Fetch raw content
2. Extract and clean with Readability
3. Summarize with OpenAI
4. Tag with AI classification
5. Create embeddings for search
6. Mark as `indexed = true`

### Database Queries
- Use batch queries where possible (see [utils/post-tools/process-feeds.ts:86-92](utils/post-tools/process-feeds.ts#L86-L92))
- Always include proper error handling for Supabase operations
- Use `createClient()` from `utils/supabase/server.ts` for server components

### Vector Search
- Embeddings use 1536 dimensions (text-embedding-3-small)
- Content is chunked with LangChain's `RecursiveCharacterTextSplitter`
- Always include metadata in Pinecone for citation generation
- Two-tier scoring ensures balance between precision and recall

### Type Safety
- Supabase types are auto-generated: `npm run update-types`
- Never manually edit [types/supabase.ts](types/supabase.ts)
- Use `Database['public']['Tables'][table_name]['Row']` for type inference
