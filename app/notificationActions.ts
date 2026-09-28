'use server'

import { createClient } from '@/lib/supabase/server'

// Called when the bell dropdown opens with unread items. Only the student
// role's items are marked read by this timestamp (see lib/notifications.ts) —
// they stay listed, just no longer "new". For other roles the bell shows queue
// depth (unresolved work), which shouldn't clear just because it was looked
// at, so this write is a harmless no-op for them.
export async function markNotificationsSeen() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ notifications_seen_at: new Date().toISOString() }).eq('id', user.id)
}
