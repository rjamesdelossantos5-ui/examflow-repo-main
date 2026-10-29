import type { createClient } from '@/lib/supabase/server'
import { deleteOrphanedSessions } from '@/lib/verificationGroup'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Grace window after the exam before a form is purged. The app runs in UTC on
// Vercel while the school is UTC+8, and a form shouldn't vanish while the exam is
// still being taken — so we wait a full day past the exam's (last) day. Net
// effect: a form disappears the day after its exam. Bump this to linger longer.
const GRACE_MS = 24 * 60 * 60 * 1000

interface PurgeCandidate {
  id: string
  status: string
  subject_id: string | null
  teacher_id: string | null
  exam_type: string | null
  period_id: string | null
  final_schedule: string | null
  didit_session_id: string | null
}

/**
 * Permanently deletes accepted/scheduled special-exam requests once their exam
 * has passed — and, for any that reached 'scheduled' (i.e. the student actually
 * took the exam), first writes an anonymized row to `exam_history` so the Admin
 * Analytics dashboard keeps a permanent count. See migration_exam_history.sql
 * for why that table carries no student-identifying data.
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
 * delete button (migration_delete.sql), and it cascades the request's media rows
 * + progress logs. Storage files aren't part of that cascade, so their paths are
 * read before the delete and the files removed after it.
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
    // term/semester/school_year/exam_day ride along so the history row (below)
    // can record WHEN and which term an exam belonged to.
    const { data: periods } = await supabase
      .from('exam_periods')
      .select('id, term, semester, school_year, exam_day, exam_end_day')
    type PeriodRow = { id: string; term: string | null; semester: string | null; school_year: string | null; exam_day: string | null; exam_end_day: string | null }
    const periodMap = new Map<string, PeriodRow>((periods ?? []).map((p) => [p.id as string, p as PeriodRow]))
    const expiredPeriodIds = [...periodMap.values()]
      .filter((p) => {
        const end = p.exam_end_day ?? p.exam_day
        return !!end && new Date(end).getTime() < cutoffMs
      })
      .map((p) => p.id)

    // Which accepted/scheduled forms to remove: those tied to a finished period,
    // plus any with an explicit past final_schedule (override-scheduled ones).
    // Full rows (not just ids) so the ones reaching 'scheduled' can be logged.
    const candidates = new Map<string, PurgeCandidate>()
    const SELECT = 'id, status, subject_id, teacher_id, exam_type, period_id, final_schedule, didit_session_id'

    // Only forms nobody has touched for the grace period. A form is removed after
    // its exam is over AND it has sat unchanged for a day. Without the updated_at
    // check, a form accepted (or assessed, or paid) TODAY into a term whose exam
    // date had already passed was deleted on the very next page load — the student
    // saw "no longer available" and it vanished from the Admin and Program Head
    // lists while the Registrar still had it on screen.
    if (expiredPeriodIds.length) {
      const { data } = await supabase
        .from('special_exam_requests')
        .select(SELECT)
        .in('status', ['accepted', 'scheduled'])
        .in('period_id', expiredPeriodIds)
        .lt('updated_at', cutoffIso)
      for (const r of (data ?? []) as PurgeCandidate[]) candidates.set(r.id, r)
    }

    const { data: byFinal } = await supabase
      .from('special_exam_requests')
      .select(SELECT)
      .in('status', ['accepted', 'scheduled'])
      .not('final_schedule', 'is', null)
      .lt('final_schedule', cutoffIso)
      .lt('updated_at', cutoffIso)
    for (const r of (byFinal ?? []) as PurgeCandidate[]) candidates.set(r.id, r)

    if (!candidates.size) return
    const idList = [...candidates.keys()]

    // Storage paths are read now, while the media rows still exist (the delete
    // below cascades them away); the files themselves are removed only for the
    // requests that really were deleted.
    const { data: media } = await supabase
      .from('application_media')
      .select('request_id, storage_path')
      .in('request_id', idList)

    // Delete FIRST, and get back only the rows actually deleted. Everything
    // after this works from that list, so a request is logged to history at most
    // once: if the delete is refused (e.g. the requests_ph_admin_delete policy is
    // missing, which RLS reports as zero rows, not an error) nothing is logged,
    // and when two page loads race, only the one whose delete removed the row
    // logs it. Logging before deleting used to re-insert the same requests into
    // exam_history on every page load whenever the delete failed.
    // The .in(status) guard is defence-in-depth over RLS: never delete a row that
    // slipped back into an active stage between the select above and now.
    const { data: deletedRows, error: deleteErr } = await supabase
      .from('special_exam_requests')
      .delete()
      .in('id', idList)
      .in('status', ['accepted', 'scheduled'])
      // Repeated on the delete: a form that changed after it was selected above
      // (someone just acted on it) is left alone.
      .lt('updated_at', cutoffIso)
      .select('id')
    if (deleteErr) console.error('purgeExpiredExams: delete failed', deleteErr.message)
    const deletedIds = new Set((deletedRows ?? []).map((r) => r.id as string))
    if (deletedIds.size < idList.length) {
      console.error(`purgeExpiredExams: ${idList.length - deletedIds.size} of ${idList.length} finished requests were not deleted (check the requests_ph_admin_delete policy)`)
    }
    if (!deletedIds.size) return
    const deleted = [...candidates.values()].filter((r) => deletedIds.has(r.id))

    // Anonymized history for the deleted ones that reached 'scheduled' (i.e.
    // took the exam). The category facts (subject → department, exam type,
    // term) were captured in `candidates` before the delete.
    const scheduled = deleted.filter((r) => r.status === 'scheduled')
    if (scheduled.length) {
      const subjectIds = [...new Set(scheduled.map((r) => r.subject_id).filter((x): x is string => !!x))]
      const { data: subjects } = subjectIds.length
        ? await supabase.from('subjects').select('id, department_id').in('id', subjectIds)
        : { data: [] as { id: string; department_id: string | null }[] }
      const deptBySubject = new Map((subjects ?? []).map((s) => [s.id as string, s.department_id as string | null]))

      const historyRows = scheduled.map((r) => {
        const period = r.period_id ? periodMap.get(r.period_id) : undefined
        // Prefer the period's exam day (the actual exam date); fall back to
        // final_schedule for the rare override path with no period.
        const dateSource = period?.exam_day ?? r.final_schedule
        return {
          exam_date: dateSource ? new Date(dateSource).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          department_id: r.subject_id ? (deptBySubject.get(r.subject_id) ?? null) : null,
          subject_id: r.subject_id,
          // Who the request was routed to, for Teacher Analytics.
          teacher_id: r.teacher_id,
          exam_type: r.exam_type,
          term: period?.term ?? null,
          semester: period?.semester ?? null,
          school_year: period?.school_year ?? null,
        }
      })
      // Best-effort: if exam_history isn't migrated yet, the count is lost but
      // the purge itself has already happened.
      let { error: historyErr } = await supabase.from('exam_history').insert(historyRows)
      if (historyErr) {
        // migration_exam_history_teacher.sql not run yet (no teacher_id
        // column) — keep the count; only the Teacher's own view of it is lost.
        ;({ error: historyErr } = await supabase.from('exam_history').insert(historyRows.map(({ teacher_id: _omit, ...row }) => row)))
      }
      if (historyErr) console.error('purgeExpiredExams: history insert failed', historyErr.message)
    }

    // Uploaded files aren't part of the database cascade; remove them now.
    const paths = (media ?? [])
      .filter((m) => deletedIds.has(m.request_id as string))
      .map((m) => m.storage_path as string)
      .filter(Boolean)
    if (paths.length) await supabase.storage.from('exam-documents').remove(paths)

    // The parent's ID and selfie photos are kept at Didit for the whole term
    // (one check can cover several requests) and go with the term's requests.
    await deleteOrphanedSessions(supabase, deleted.map((r) => r.didit_session_id))
  } catch {
    // Best-effort cleanup — swallow everything so the page still renders.
  }
}
