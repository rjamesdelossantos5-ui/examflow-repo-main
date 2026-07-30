import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Grace window after the exam before a form is purged. The app runs in UTC on
// Vercel while the school is UTC+8, and a form shouldn't vanish while the exam is
// still being taken — so we wait a full day past the exam's (last) day. Net
// effect: a form disappears the day after its exam. Bump this to linger longer.
const GRACE_MS = 24 * 60 * 60 * 1000

/**
 * Permanently deletes accepted/scheduled special-exam requests once their exam
 * has passed.
 *
 * The exam date lives on the PERIOD (`exam_periods.exam_day` / `exam_end_day`),
 * and every request points to its period via `period_id` — that's the date that
 * decides "the exam is over". (The per-request `final_schedule` is only set on
 * the rare override path, so we also honour it when it happens to be present.)
 * In-progress forms (still submitted/under review) are never touched — only
 * `accepted`/`scheduled` ones.
 *
 * Deletion is RLS-guarded to `accepted`/`scheduled` and to Program Head / admin
 * callers by the same `requests_ph_admin_delete` policy that powers the manual
 * delete button, and it cascades the request's media rows + progress logs.
 * Storage files aren't part of that cascade, so we remove them first.
 *
 * This is a page-load cleanup: it runs before the Overview / Accepted Students
 * queries so the freshly-loaded list already excludes the purged rows. It must
 * NOT call revalidatePath (illegal during render) and is fully best-effort — any
 * failure is swallowed so a cleanup hiccup can never break the page.
 */
export async function purgeExpiredExams(supabase: SupabaseServerClient): Promise<void> {
  try {
    const cutoffMs = Date.now() - GRACE_MS
    const cutoffIso = new Date(cutoffMs).toISOString()

    // Periods whose special exam has finished (a day past the last exam day).
    const { data: periods } = await supabase
      .from('exam_periods')
      .select('id, exam_day, exam_end_day')
    const expiredPeriodIds = (periods ?? [])
      .filter((p) => {
        const end = (p.exam_end_day as string | null) ?? (p.exam_day as string | null)
        return !!end && new Date(end).getTime() < cutoffMs
      })
      .map((p) => p.id as string)

    // Which accepted/scheduled forms to remove: those tied to a finished period,
    // plus any with an explicit past final_schedule (override-scheduled ones).
    const ids = new Set<string>()

    if (expiredPeriodIds.length) {
      const { data } = await supabase
        .from('special_exam_requests')
        .select('id')
        .in('status', ['accepted', 'scheduled'])
        .in('period_id', expiredPeriodIds)
      for (const r of data ?? []) ids.add(r.id as string)
    }

    const { data: byFinal } = await supabase
      .from('special_exam_requests')
      .select('id')
      .in('status', ['accepted', 'scheduled'])
      .not('final_schedule', 'is', null)
      .lt('final_schedule', cutoffIso)
    for (const r of byFinal ?? []) ids.add(r.id as string)

    if (!ids.size) return
    const idList = [...ids]

    // Clear their uploaded files from storage before the DB cascade removes the
    // media rows (otherwise the files would be orphaned in the bucket).
    const { data: media } = await supabase
      .from('application_media')
      .select('storage_path')
      .in('request_id', idList)
    const paths = (media ?? []).map((m) => m.storage_path as string).filter(Boolean)
    if (paths.length) await supabase.storage.from('exam-documents').remove(paths)

    // The .in(status) guard is defence-in-depth over RLS: never delete a row that
    // slipped back into an active stage between the select above and now.
    await supabase
      .from('special_exam_requests')
      .delete()
      .in('id', idList)
      .in('status', ['accepted', 'scheduled'])
  } catch {
    // Best-effort cleanup — swallow everything so the page still renders.
  }
}
