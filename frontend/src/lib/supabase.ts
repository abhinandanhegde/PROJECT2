import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    _client = createClient(url, key)
  }
  return _client
}

// Lazy proxy so existing `supabase.auth.*` calls still work
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase()
    const val = Reflect.get(client, prop)
    if (typeof val === 'function') return val.bind(client)
    return val
  },
})
