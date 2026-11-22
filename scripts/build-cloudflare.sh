#!/usr/bin/env bash
set -euo pipefail

# Build OpenNext for Cloudflare without baking server secrets into the bundle.
#
# Next loads `.env.local` automatically, and OpenNext compiles those values into
# `.open-next/cloudflare/next-env.mjs`. For Cloudflare, only NEXT_PUBLIC_* values
# belong in the build; runtime secrets should be Worker secrets.
#
# This script temporarily moves `.env.local` aside, writes a public-only
# `.env.production.local`, runs the build, then restores everything.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.local"
PUBLIC_ENV="$ROOT/.env.production.local"
BACKUP=""
SOURCE_ENV=""

restore() {
  rm -f "$PUBLIC_ENV"
  if [ -n "$BACKUP" ] && [ -f "$BACKUP" ]; then
    mv "$BACKUP" "$ENV_FILE"
  fi
}
trap restore EXIT

if [ -f "$ENV_FILE" ]; then
  BACKUP="$(mktemp "${TMPDIR:-/tmp}/uxlift-env.XXXXXX")"
  cp "$ENV_FILE" "$BACKUP"
  SOURCE_ENV="$BACKUP"
  rm "$ENV_FILE"
fi

export SOURCE_ENV

node <<'NODE'
const fs = require("fs");

const publicKeys = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
  "NEXT_PUBLIC_CLOUDINARY_API_KEY",
  "NEXT_PUBLIC_GITHUB_REPO_OWNER",
  "NEXT_PUBLIC_GITHUB_REPO_NAME",
  "NEXT_PUBLIC_SITE_URL",
]);

const sourcePath = process.env.SOURCE_ENV || "";
const source = sourcePath && fs.existsSync(sourcePath)
  ? fs.readFileSync(sourcePath, "utf8")
  : "";

const lines = [];
for (const line of source.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && publicKeys.has(match[1])) lines.push(line);
}

for (const key of publicKeys) {
  if (!lines.some((line) => line.startsWith(`${key}=`)) && process.env[key]) {
    lines.push(`${key}=${process.env[key]}`);
  }
}

if (!lines.some((line) => line.startsWith("SITE_URL="))) {
  lines.push(`SITE_URL=${process.env.SITE_URL || "https://www.uxlift.org"}`);
}

if (
  process.env.STATIC_ARTICLE_LIMIT &&
  !lines.some((line) => line.startsWith("STATIC_ARTICLE_LIMIT="))
) {
  lines.push(`STATIC_ARTICLE_LIMIT=${process.env.STATIC_ARTICLE_LIMIT}`);
}

// Server-only values are needed while Next collects page data, but they must
// not be the real secrets. Runtime values come from Worker secrets, which
// override this file.
const buildPlaceholders = {
  OPENAI_API_KEY: "build-placeholder",
  PINECONE_API_KEY: "build-placeholder",
  PINECONE_INDEX_NAME: "uxlift",
  SUPABASE_SERVICE_ROLE_KEY: "build-placeholder",
  NEBIUS_API_KEY: "build-placeholder",
  BEEHIIV_API_KEY: "build-placeholder",
  BEEHIIV_PUBLICATION_ID: "build-placeholder",
  CLOUDINARY_API_SECRET: "build-placeholder",
  GITHUB_PAT: "build-placeholder",
  GITHUB_REPO_OWNER: "MattKevan",
  GITHUB_REPO_NAME: "uxlift-next",
  CRON_SECRET: "build-placeholder",
  INTERNAL_SECRET: "build-placeholder",
  REVALIDATE_SECRET: "build-placeholder",
};

for (const [key, value] of Object.entries(buildPlaceholders)) {
  if (!lines.some((line) => line.startsWith(`${key}=`))) {
    lines.push(`${key}=${value}`);
  }
}

fs.writeFileSync(".env.production.local", `${lines.join("\n")}\n`);
NODE

npx opennextjs-cloudflare build "$@"
