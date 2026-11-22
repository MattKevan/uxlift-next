import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { reprocessResource } from '@/utils/resource-tools/fetch-resource-content'
import type { Database } from '@/types/supabase'

function fail(message: string): never {
  console.error(`[reprocess-resource] ${message}`)
  process.exit(1)
}

async function main() {
  const rawResourceId = process.argv[2]

  if (!rawResourceId) {
    fail('Missing resource id argument. Usage: tsx scripts/reprocess-resource.ts <resourceId>')
  }

  const resourceId = Number(rawResourceId)
  if (!Number.isInteger(resourceId) || resourceId <= 0) {
    fail(`Invalid resource id: ${rawResourceId}`)
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    fail('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('[reprocess-resource] starting', { resourceId })
  const resource = await reprocessResource(resourceId, supabase)
  console.log('[reprocess-resource] completed', {
    resourceId: resource.id,
    title: resource.title,
  })
}

main().catch((error) => {
  console.error('[reprocess-resource] failed', error)
  process.exit(1)
})
