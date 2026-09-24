import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ⚠️ SERVER-ONLY. Never import this into a 'use client' component or
// expose SUPABASE_SERVICE_ROLE_KEY with a NEXT_PUBLIC_ prefix — this key
// bypasses Row Level Security entirely.
//
// Add to .env.local AND your Vercel project's environment variables:
//   SUPABASE_SERVICE_ROLE_KEY=... (Project Settings → API → service_role key)
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
