'use client'

import { createBrowserClient } from '@supabase/ssr'

// Supabase client for the BROWSER side (Client Components: realtime
// subscriptions, storage uploads, client-side queries). Uses the public anon
// key — actual data access is enforced by RLS policies, not by this key.
// Server Components / Server Actions must use lib/supabase/server.ts instead.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
