'use server'

import { createClient } from '@/lib/supabase/server'

// Called when the bell dropdown opens. Only the student role's notification
// list actually filters by this timestamp (see lib/notifications.ts) — for
// other roles the bell shows queue depth (unresolved work), which shouldn't
// disappear just because it was looked at, so this write is a harmless no-op
// for them.
export async function markNotificationsSeen() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ notifications_seen_at: new Date().toISOString() }).eq('id', user.id)
}
