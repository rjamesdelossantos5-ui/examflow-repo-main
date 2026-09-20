'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, SERVICE_KEY_MISSING } from '@/lib/supabase/admin'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'

// DESTRUCTIVE test-data reset. This exists so a demo or test run can start
// clean without waiting for real dates to pass — it is not a school workflow.
//
// It deletes every special exam request, its progress logs, its media rows and
// the actual files those rows point at. It deliberately does NOT touch user
// accounts, subjects, departments, class offerings or exam periods, so the next
// test run can submit immediately with nothing to re-import.
//
// This replaces supabase/reset_forms.sql, which had to be pasted into the SQL
// editor by hand — and which cannot delete the uploaded files at all, because
// Supabase rejects direct SQL deletes on storage.objects. Going through the
// Storage API here is the only way to clear the bucket as part of the reset.
//
// ⚠️  The deletes run on the SERVICE-ROLE client, which bypasses RLS. That is
// required, not a shortcut: progress_logs has no delete policy at all (an RLS
// delete there affects 0 rows), and requests_ph_admin_delete only permits an
// admin to delete rows at status 'accepted' or 'scheduled'. Through RLS this
// action would report success while leaving almost everything behind. The
// admin check below runs on the COOKIE client first, so the service-role client
// is only ever reached by a verified admin.

/** Verifies the caller is an admin using their own session — never the
 *  service-role client, which acts as no one and would authorise everybody. */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return null
  return { userId: user.id }
}

// Supabase caps a single .remove() call, so files go in batches rather than one
// request carrying every path.
const STORAGE_BATCH = 100

/** What a reset would destroy right now, for the confirmation dialog. Read
 *  before anything is deleted so the admin sees the real scale. */
export async function getResetPreview() {
  if (!(await requireAdmin())) return { error: 'Unauthorized', preview: null }
  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_KEY_MISSING, preview: null }

  const [reqs, media] = await Promise.all([
    admin.from('special_exam_requests').select('id', { count: 'exact', head: true }),
    admin.from('application_media').select('id', { count: 'exact', head: true }),
  ])

  if (reqs.error) {
    return { error: friendlyError('getResetPreview', reqs.error, `We couldn't check the data. ${RETRY_HINT}`), preview: null }
  }

  return {
    error: null,
    preview: {
      requests: reqs.count ?? 0,
      // Null rather than 0 when the count failed: "we don't know" must not be
      // displayed as "there are none".
      files: media.error ? null : (media.count ?? 0),
    },
  }
}

/** Deletes every request and every file belonging to one. Irreversible. */
export async function resetRequests() {
  if (!(await requireAdmin())) return { error: 'Unauthorized' }
  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_KEY_MISSING }

  // 1. Files first. If the request rows went first, the media rows would cascade
  //    away with them and their storage paths would be unrecoverable — the files
  //    would sit in the bucket forever with nothing pointing at them.
  const { data: media, error: mediaErr } = await admin
    .from('application_media')
    .select('storage_path')

  if (mediaErr) {
    return { error: friendlyError('resetRequests:media', mediaErr, `We couldn't read the uploaded files. ${RETRY_HINT}`) }
  }

  const paths = (media ?? []).map((m) => m.storage_path as string).filter(Boolean)
  let filesRemoved = 0
  let fileWarning: string | null = null

  for (let i = 0; i < paths.length; i += STORAGE_BATCH) {
    const batch = paths.slice(i, i + STORAGE_BATCH)
    const { error } = await admin.storage.from('exam-documents').remove(batch)
    // A storage failure must not abort the reset: the rows still need to go, and
    // a leftover file with no row is recoverable clutter, not corruption. It is
    // reported rather than swallowed.
    if (error) fileWarning = error.message
    else filesRemoved += batch.length
  }

  // 2. Progress logs, then media rows, then the requests themselves. Each is
  //    explicit rather than trusting cascade, because the cascade rules are not
  //    identical across the migrations this database has accumulated.
  //    'not id is null' is how PostgREST expresses "every row" — a bare delete()
  //    with no filter is rejected.
  const { error: logErr } = await admin.from('progress_logs').delete().not('id', 'is', null)
  if (logErr) {
    return { error: friendlyError('resetRequests:logs', logErr, `We couldn't clear the activity logs. ${RETRY_HINT}`) }
  }

  const { error: mediaDelErr } = await admin.from('application_media').delete().not('id', 'is', null)
  if (mediaDelErr) {
    return { error: friendlyError('resetRequests:mediaRows', mediaDelErr, `We couldn't clear the file records. ${RETRY_HINT}`) }
  }

  // override_requests reference special_exam_requests ON DELETE CASCADE, so they
  // go with this and need no separate delete.
  const { data: deleted, error: reqErr } = await admin
    .from('special_exam_requests')
    .delete()
    .not('id', 'is', null)
    .select('id')

  if (reqErr) {
    return { error: friendlyError('resetRequests:requests', reqErr, `We couldn't clear the requests. ${RETRY_HINT}`) }
  }

  // Every surface that lists requests, for all five roles.
  for (const p of [
    '/admin', '/admin/analytics', '/student', '/student/history',
    '/registrar', '/registrar/history', '/registrar/assessment',
    '/teacher', '/teacher/history',
    '/program-head', '/program-head/receipts', '/program-head/overview', '/program-head/students',
  ]) revalidatePath(p)

  return {
    error: null,
    deletedRequests: (deleted ?? []).length,
    filesRemoved,
    fileWarning,
  }
}
