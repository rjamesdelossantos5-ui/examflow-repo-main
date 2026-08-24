import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * SERVICE-ROLE Supabase client. Used ONLY for Supabase Auth's admin endpoints
 * (creating and deleting auth users), which the anon key cannot call.
 *
 * ⚠️  This key BYPASSES EVERY ROW-LEVEL SECURITY POLICY. Rules:
 *
 *   1. NEVER prefix the env var with NEXT_PUBLIC_ — that would compile the key
 *      into the browser bundle and hand every visitor unrestricted database
 *      access. It is deliberately named without the prefix.
 *   2. NEVER import this file from a Client Component. The `server-only` import
 *      above turns that into a build error rather than a silent leak.
 *   3. Only call it from a server action that has ALREADY verified the caller
 *      is an admin — this client will not check for you.
 *   4. Use lib/supabase/server.ts for everything else. Reads and writes should
 *      go through RLS; this exists purely because auth.admin.* requires it.
 *
 * Returns null when the key isn't configured, so callers can show a clear
 * "not configured" message instead of crashing with an opaque 403.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  return createSupabaseClient(url, serviceKey, {
    auth: {
      // No session persistence or token refresh: this client is created per
      // request, acts as no one, and must never write auth cookies.
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/** Shown to the admin when SUPABASE_SERVICE_ROLE_KEY is missing. */
export const SERVICE_KEY_MISSING =
  'Account management is not configured on the server. Add SUPABASE_SERVICE_ROLE_KEY to the environment variables (Supabase Dashboard → Project Settings → API → service_role key), then redeploy.'
