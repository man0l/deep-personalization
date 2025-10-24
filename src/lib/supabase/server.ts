import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function supabaseServer(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const serviceRoleKey = (process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) as string
  if (!supabaseUrl) throw new Error('Missing env NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing env SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}


