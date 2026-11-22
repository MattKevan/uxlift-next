#!/usr/bin/env bash
set -euo pipefail

# Upload server-side secrets to the Cloudflare Worker without printing values.
# Run this after the Worker exists (i.e. after the first `wrangler deploy`).
#
# Usage:
#   bash scripts/set-cloudflare-secrets.sh
#
# It reads server values from .env.local. NEXT_PUBLIC_* values are build-time
# only and are not uploaded here.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.local"
TMP_FILE="$(mktemp "${TMPDIR:-/tmp}/uxlift-secrets.XXXXXX")"

cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# Persist the revalidation secret so it stays stable across deploys.
if ! grep -q '^REVALIDATE_SECRET=' "$ENV_FILE"; then
  printf '\nREVALIDATE_SECRET=%s\n' "$(openssl rand -base64 32)" >> "$ENV_FILE"
fi

KEYS=(
  OPENAI_API_KEY
  PINECONE_API_KEY
  PINECONE_INDEX_NAME
  SUPABASE_SERVICE_ROLE_KEY
  NEBIUS_API_KEY
  NEBIUS_LLM_MODEL
  BEEHIIV_API_KEY
  BEEHIIV_PUBLICATION_ID
  CLOUDINARY_API_SECRET
  GITHUB_PAT
  GITHUB_WORKFLOW_TOKEN
  GITHUB_REPO_OWNER
  GITHUB_REPO_NAME
  CRON_SECRET
  INTERNAL_SECRET
  REVALIDATE_SECRET
  SITE_URL
)

for key in "${KEYS[@]}"; do
  if grep -q "^${key}=" "$ENV_FILE"; then
    grep "^${key}=" "$ENV_FILE" >> "$TMP_FILE"
  fi
done

if ! grep -q '^SITE_URL=' "$TMP_FILE"; then
  echo "SITE_URL=${SITE_URL:-https://www.uxlift.org}" >> "$TMP_FILE"
fi

chmod 600 "$TMP_FILE"

echo "Uploading $(wc -l < "$TMP_FILE" | tr -d ' ') Worker secrets:"
cut -d= -f1 "$TMP_FILE" | sed 's/^/  - /'

wrangler secret bulk "$TMP_FILE"

echo
echo "GitHub Actions also needs these repository secrets:"
echo "  REVALIDATE_SECRET  (same value as the Worker secret)"
echo "  SITE_URL=https://www.uxlift.org"
echo
echo "You can set them with:"
echo "  gh secret set REVALIDATE_SECRET"
echo "  gh secret set SITE_URL --body \"https://www.uxlift.org\""
