import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Grace window after the scheduled exam time before a form is purged. The app
// runs in UTC on Vercel while the school is UTC+8, and an exam scheduled for
// 2 PM shouldn't vanish at 2 PM while it's still being taken — so we wait a full
// day past the exam's date/time. Net effect: a form disappears the day after its
// exam. Bump this if records should linger longer.
const GRACE_MS = 24 * 60 * 60 * 1000

/**
 * Permanently deletes special-exam requests whose exam date has already passed.
 *
 * Only rows that actually reached scheduling have a `final_schedule` (the exam
 * date/time), so in-progress forms are never touched. Deletion is RLS-guarded to
 * `accepted`/`scheduled` and to Program Head / admin callers by the same
 * `requests_ph_admin_delete` policy that powers the manual delete button, and it
 * cascades the request's media rows + progress logs. Storage files aren't part of
 * that cascade, so we remove them first (best-effort).
 *
 * This is a page-load cleanup: it runs before the Overview / Accepted Students
 * queries so the freshly-loaded list already excludes the purged rows. It must
 * NOT call revalidatePath (illegal during render) and is fully best-effort — any
 * failure is swallowed so a cleanup hiccup can never break the page.
 */
export async function purgeExpiredExams(supabase: SupabaseServerClient): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - GRACE_MS).toISOString()

    // Which finished forms are past their exam date?
    const { data: expired } = await supabase
      .from('special_exam_requests')
      .select('id')
      .in('status', ['accepted', 'scheduled'])
      .not('final_schedule', 'is', null)
      .lt('final_schedule', cutoff)

    const ids = (expired ?? []).map((r) => r.id as string)
    if (!ids.length) return

    // Clear their uploaded files from storage before the DB cascade removes the
    // media rows (otherwise the files would be orphaned in the bucket).
    const { data: media } = await supabase
      .from('application_media')
      .select('storage_path')
      .in('request_id', ids)
    const paths = (media ?? []).map((m) => m.storage_path as string).filter(Boolean)
    if (paths.length) await supabase.storage.from('exam-documents').remove(paths)

    // The .in(status) guard is defence-in-depth over RLS: never delete a row that
    // slipped back into an active stage between the select above and now.
    await supabase
      .from('special_exam_requests')
      .delete()
      .in('id', ids)
      .in('status', ['accepted', 'scheduled'])
  } catch {
    // Best-effort cleanup — swallow everything so the page still renders.
  }
}
