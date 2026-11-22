#!/usr/bin/env bash
set -euo pipefail

# Safe Cloudflare deploy:
#   1. create/update a placeholder Worker so secrets can be uploaded first
#   2. upload real Worker secrets (no placeholder secrets are ever public)
#   3. build the Next.js app without baking server secrets
#   4. deploy the real Worker
#
# This keeps the free-tier setup: R2 + D1 + direct queue, no paid Workers.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PLACEHOLDER_DIR="$(mktemp -d "${TMPDIR:-/tmp}/uxlift-cf-placeholder.XXXXXX")"

cleanup() {
  rm -rf "$PLACEHOLDER_DIR"
}
trap cleanup EXIT

cat > "$PLACEHOLDER_DIR/worker.js" <<'JS'
export default {
  async fetch() {
    return new Response("UX Lift is being configured.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
JS

cat > "$PLACEHOLDER_DIR/wrangler.jsonc" <<JSON
{
  "name": "uxlift",
  "main": "$PLACEHOLDER_DIR/worker.js",
  "compatibility_date": "2025-03-25",
  "workers_dev": true
}
JSON

echo "1/5 Creating the Worker so secrets can be uploaded before the app is public..."
npx wrangler deploy --config "$PLACEHOLDER_DIR/wrangler.jsonc"

echo "2/5 Uploading Worker secrets..."
bash scripts/set-cloudflare-secrets.sh

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "3/5 Setting GitHub Actions revalidation secrets..."
  grep '^REVALIDATE_SECRET=' .env.local | cut -d= -f2- | gh secret set REVALIDATE_SECRET
  gh secret set SITE_URL --body "https://www.uxlift.org"
  if grep -q '^REVALIDATE_URL=' .env.local; then
    grep '^REVALIDATE_URL=' .env.local | cut -d= -f2- | gh secret set REVALIDATE_URL
  fi
else
  echo "3/5 Skipping GitHub secrets (gh is not authenticated)."
  echo "    Run: gh secret set REVALIDATE_SECRET"
  echo "    Run: gh secret set SITE_URL --body \"https://www.uxlift.org\""
fi

echo "4/5 Building the app..."
npm run cf:build

echo "5/6 Deploying the real Worker..."
# Deploy the built Worker directly. `opennextjs-cloudflare deploy` also tries to
# pre-populate R2; without R2 API credentials that falls back to a very slow
# sequential upload. The R2 cache fills on demand at runtime instead.
npx wrangler deploy

echo "6/6 Deploying the apex redirect Worker..."
npx wrangler deploy --config wrangler.apex.jsonc

echo
echo "Deploy complete."
echo "www.uxlift.org serves the main Worker; uxlift.org 301s to www."
