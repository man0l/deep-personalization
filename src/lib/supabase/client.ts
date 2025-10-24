import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl) {
  throw new Error('Missing env NEXT_PUBLIC_SUPABASE_URL')
}

if (!anonKey) {
  throw new Error('Missing env NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabaseBrowser = () => createClient(supabaseUrl, anonKey)


