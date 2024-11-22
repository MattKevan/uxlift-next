const { createClient: createSupabaseClient } = require('@supabase/supabase-js')

const createClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

module.exports = createClient
