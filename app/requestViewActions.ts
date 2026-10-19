'use server'

import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IDS = 50

// Records that the signed-in user has opened these requests, so the bell stops
// counting them until something changes on them (see
// supabase/migration_request_views.sql and lib/notifications.ts). Each person
// only writes their own rows (RLS). Best-effort: if the table isn't set up yet
// this just reports it, and the bell keeps counting as before.
export async function markRequestsViewed(ids: string[]): Promise<{ error: string | null }> {
  const clean = [...new Set(ids)].filter((id) => UUID.test(id)).slice(0, MAX_IDS)
  if (!clean.length) return { error: null }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('request_views')
    .upsert(clean.map((request_id) => ({ user_id: user.id, request_id, viewed_at: now })), { onConflict: 'user_id,request_id' })
  if (error) {
    console.error('[markRequestsViewed]', error)
    return { error: error.message }
  }
  return { error: null }
}
