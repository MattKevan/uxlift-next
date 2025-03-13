# Supabase Edge Functions for Feed Processing

This directory contains Supabase Edge Functions for processing RSS feeds. These functions replace the Vercel Cron job that was previously used for this purpose.

## Architecture

The feed processing system consists of the following components:

1. **Controller Function (`process-feeds-controller`)**: Manages the overall process and orchestrates workers
2. **Worker Function (`process-feeds-worker`)**: Processes batches of feeds/articles with background task support
3. **Database**: Stores state, progress, and processed content
4. **Event System**: Enables future extensions through event-based triggers
5. **Background Processing**: Uses EdgeRuntime.waitUntil() to continue processing after responding to requests
6. **CORS Support**: Includes proper CORS headers for browser access

## Prerequisites

- Supabase CLI installed and configured
- Supabase project linked to your local environment
- Environment variables set up:
  - `OPENAI_API_KEY`: Your OpenAI API key
  - `PINECONE_API_KEY`: Your Pinecone API key
  - `PINECONE_INDEX_NAME`: Your Pinecone index name

## Dependency Management

Each Edge Function has its own `deno.json` file to manage dependencies:

- `supabase/functions/process-feeds-controller/deno.json`: Controller function dependencies
- `supabase/functions/process-feeds-worker/deno.json`: Worker function dependencies
- `supabase/functions/_shared/deno.json`: Shared module dependencies

This ensures proper isolation between functions and is the recommended approach for deployment.

## Environment Variables

The system requires several environment variables to function properly:

1. **Local Development**:
   - Copy `supabase/functions/.env.example` to `supabase/functions/.env`
   - Fill in your API keys and other configuration
   - Run with: `supabase functions serve --env-file ./supabase/functions/.env`

2. **Production**:
   - Set secrets using the deployment script or manually:
     ```bash
     supabase secrets set --env-file ./supabase/functions/.env
     # Or individually
     supabase secrets set OPENAI_API_KEY="your-key-here"
     ```

## Deployment

You can deploy the Edge Functions using the provided deployment script:

```bash
./scripts/deploy-edge-functions.sh
```

This script will:
1. Apply database migrations
2. Deploy the shared modules
3. Deploy the controller and worker functions
4. Set up scheduled execution
5. Set the required environment variables

### Edge Runtime Configuration

The Edge Functions are configured to use the `per_worker` policy in `supabase/config.toml`:

```toml
[edge_runtime]
policy = "per_worker"
```

This configuration prevents function instances from being terminated automatically after a request is completed, allowing background tasks to run to completion. Note that with this policy, functions won't auto-reload on edits during development. You'll need to manually restart them by running `supabase functions serve`.

### CORS Configuration

The Edge Functions include CORS support for browser access. This is implemented using a shared CORS headers file:

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
```

Each function handles OPTIONS requests for CORS preflight and includes the CORS headers in all responses. This allows the functions to be called directly from the browser, which is used in the admin interface.

Alternatively, you can deploy the functions manually:

```bash
# Apply database migrations
supabase db push

# Deploy shared modules
supabase functions deploy _shared

# Deploy controller function
supabase functions deploy process-feeds-controller

# Deploy worker function
supabase functions deploy process-feeds-worker

# Set up scheduled execution (every hour)
supabase functions schedule create process-feeds-hourly \
  --function process-feeds-controller \
  --schedule "0 * * * *" \
  --body '{"isCron": true}'

# Set environment variables
supabase secrets set OPENAI_API_KEY="your-openai-api-key"
supabase secrets set PINECONE_API_KEY="your-pinecone-api-key"
supabase secrets set PINECONE_INDEX_NAME="your-pinecone-index-name"
```

## Monitoring

You can monitor the execution of the Edge Functions in the admin dashboard at `/admin/activity-logs`. This page shows:

- A list of all function executions
- Details about active jobs
- Progress information
- Error logs

## Database Schema

The system uses the following database tables:

- `feed_processing_jobs`: Tracks the status and progress of feed processing jobs
- `edge_function_logs`: Logs the execution of Edge Functions
- `edge_function_steps`: Tracks individual steps within a function execution
- `feed_processing_events`: Stores events for future extensions

## Manual Execution

You can manually trigger the feed processing by making a GET request to the controller function:

```bash
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/process-feeds-controller \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Extensibility

The system is designed to be extensible. You can add new capabilities by:

1. Creating new Edge Functions that consume events from `feed_processing_events`
2. Adding new event types to the worker function
3. Implementing new processing steps in the worker function

## Troubleshooting

If you encounter issues with the Edge Functions:

1. Check the logs in the Supabase dashboard
2. Check the activity logs in the admin dashboard
3. Verify that all environment variables are set correctly
4. Ensure that the database schema is up to date