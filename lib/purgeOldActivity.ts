import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { HIDDEN_PREFIXES } from '@/lib/historyFilter'

/** How long a User Activity entry is kept. */
export const ACTIVITY_KEEP_DAYS = 45

// There is no scheduler, so this runs when an admin page loads (see
// app/admin/layout.tsx). At most once an hour per server, so it is not a delete on
// every click.
const MIN_GAP_MS = 60 * 60 * 1000
let lastRun = 0

/**
 * Deletes User Activity entries (progress_logs) older than ACTIVITY_KEEP_DAYS, so
 * the table does not grow without limit. Entries are otherwise kept until their
 * request is deleted (they are removed with it).
 *
 * The privacy-consent record is NOT deleted here: it is the proof that the
 * student and their parent agreed (RA 10173), and stays until its request goes.
 *
 * Needs the service-role client — students, staff and admins have no delete
 * policy on progress_logs. Best-effort: a failure is logged and never breaks a page.
 */
export async function purgeOldActivity(): Promise<void> {
  const now = Date.now()
  if (now - lastRun < MIN_GAP_MS) return
  lastRun = now
  try {
    const admin = createAdminClient()
    if (!admin) return
    const cutoff = new Date(now - ACTIVITY_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString()
    let query = admin.from('progress_logs').delete().lt('created_at', cutoff)
    for (const prefix of HIDDEN_PREFIXES) query = query.not('action', 'like', `${prefix}%`)
    const { error } = await query
    if (error) console.error('[purgeOldActivity] delete failed', error.message)
  } catch (err) {
    console.error('[purgeOldActivity]', err)
  }
}
