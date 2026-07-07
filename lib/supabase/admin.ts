import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service-role client for server-only work that must bypass RLS. Right now its
// only job is looking up staff email addresses for notifications: under RLS a
// student's session can't read registrar or program-head rows, so those
// recipients are invisible to the normal request-scoped client.
//
// NEVER import this into a Client Component — the service key must never reach
// the browser. It only lives in Server Actions / server modules.
//
// Returns null when SUPABASE_SERVICE_ROLE_KEY isn't set, so the app keeps
// working (just without email) until notifications are configured in env.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
