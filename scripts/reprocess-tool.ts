import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { reprocessTool } from '@/utils/tool-tools/fetch-tool-content'
import type { Database } from '@/types/supabase'

function fail(message: string): never {
  console.error(`[reprocess-tool] ${message}`)
  process.exit(1)
}

async function main() {
  const rawToolId = process.argv[2]
  const descriptionArg = process.argv.slice(3).join(' ').trim()

  if (!rawToolId) {
    fail('Missing tool id argument. Usage: tsx scripts/reprocess-tool.ts <toolId> [description]')
  }

  const toolId = Number(rawToolId)
  if (!Number.isInteger(toolId) || toolId <= 0) {
    fail(`Invalid tool id: ${rawToolId}`)
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

  console.log('[reprocess-tool] starting', { toolId })
  const tool = await reprocessTool(toolId, supabase, {
    description: descriptionArg || undefined,
  })
  console.log('[reprocess-tool] completed', {
    toolId: tool.id,
    title: tool.title,
  })
}

main().catch((error) => {
  console.error('[reprocess-tool] failed', error)
  process.exit(1)
})
