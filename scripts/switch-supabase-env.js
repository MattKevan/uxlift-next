#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const mode = process.argv[2]
const cwd = process.cwd()
const envPath = path.join(cwd, '.env.local')
const backupPath = path.join(cwd, '.env.local.live.backup')

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function parseEnvLines(content) {
  const map = new Map()
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    const key = match[1]
    const value = match[2]
    map.set(key, value)
  }

  return map
}

function updateEnvContent(originalContent, updates) {
  const lines = originalContent.split(/\r?\n/)
  const seen = new Set()

  const updatedLines = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) return line

    const key = match[1]
    if (!Object.prototype.hasOwnProperty.call(updates, key)) {
      return line
    }

    seen.add(key)
    return `${key}=${updates[key]}`
  })

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      updatedLines.push(`${key}=${value}`)
    }
  }

  return `${updatedLines.join('\n').replace(/\n*$/, '')}\n`
}

function ensureEnvFileExists() {
  if (!fs.existsSync(envPath)) {
    fail(`Missing ${envPath}. Create it first.`)
  }
}

function backupLiveEnvIfNeeded() {
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(envPath, backupPath)
    console.log(`Created backup: ${path.basename(backupPath)}`)
  }
}

function switchToLocal() {
  ensureEnvFileExists()
  backupLiveEnvIfNeeded()

  let statusOutput = ''
  try {
    statusOutput = execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr) : ''
    fail(
      [
        'Could not read local Supabase status.',
        'Make sure local Supabase is running (`supabase start`).',
        stderr.trim(),
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  const statusMap = parseEnvLines(statusOutput)

  const localUrl = statusMap.get('NEXT_PUBLIC_SUPABASE_URL') || statusMap.get('API_URL')
  const localAnon = statusMap.get('NEXT_PUBLIC_SUPABASE_ANON_KEY') || statusMap.get('ANON_KEY')
  const localServiceRole = statusMap.get('SUPABASE_SERVICE_ROLE_KEY') || statusMap.get('SERVICE_ROLE_KEY')

  if (!localUrl || !localAnon || !localServiceRole) {
    fail('Could not resolve local Supabase URL/anon/service role from `supabase status -o env`.')
  }

  const current = fs.readFileSync(envPath, 'utf8')
  const next = updateEnvContent(current, {
    NEXT_PUBLIC_SUPABASE_URL: localUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: localAnon,
    SUPABASE_SERVICE_ROLE_KEY: localServiceRole,
  })

  fs.writeFileSync(envPath, next)

  console.log('Switched .env.local to local Supabase credentials.')
  console.log('Restart your Next.js dev server.')
}

function switchToLive() {
  if (!fs.existsSync(backupPath)) {
    fail(`Backup not found at ${backupPath}. Cannot restore live credentials.`)
  }

  fs.copyFileSync(backupPath, envPath)
  console.log('Restored .env.local from live backup.')
  console.log('Restart your Next.js dev server.')
}

if (mode === 'local') {
  switchToLocal()
} else if (mode === 'live') {
  switchToLive()
} else {
  console.log('Usage: node scripts/switch-supabase-env.js <local|live>')
  process.exit(1)
}
