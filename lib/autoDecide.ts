import 'server-only'
import { cache } from 'react'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeWindow, type ExamPeriod } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { withSubmissionGate } from '@/lib/submissionGate'
import { isStudentsOwnId } from '@/lib/didit'
import { REVERIFY_LOG_PREFIX } from '@/lib/rejectReasons'
import { emailRequestEvent, siteUrl } from '@/lib/requestEmails'

/**
 * Decisions the system makes on its own once a deadline passes, so a form is
 * never left waiting just because a reviewer did not get to it.
 *
 * 1. When the SUBMISSION WINDOW CLOSES, every form still waiting for the
 *    Teacher or the Program Head's first approval is decided:
 *      - its subject already has a form the Program Head accepted this term
 *        → accepted (excused: scheduled; paid: on to fee assessment), because it
 *        is not fair to refuse one student what another got for the same subject;
 *      - no such form → declined: the Program Head evidently did not open a
 *        special exam for that subject.
 *    Left for the Program Head, never decided here: forms whose parent ID bears
 *    the student's own name, and forms the Program Head already returned for
 *    re-verification. Those are parent problems a person has to look at.
 *    Only forms submitted before the window closed count — a form the student
 *    pressed Submit on afterwards was not submitted in time.
 *
 * 2. On the EXAM DAY, a paid form whose fees were assessed but which still has
 *    no receipt uploaded is declined. A form the Registrar never assessed is
 *    left alone: the student could not have uploaded a receipt for it.
 *
 * Runs on page load (like purgeExpiredExams) — there is no scheduler. Every
 * role's layout and main page call it, so the first page anyone opens after a
 * deadline applies it before the page reads its queue. cache() makes it run
 * once per request even when the layout and the page both call it.
 *
 * Uses the service-role client because it acts for no one in particular — it
 * must run the same whether a student or the Program Head opened the page. It
 * writes only the fixed status columns chosen here, and every update repeats
 * its status filter, so two page loads racing each other decide a form once.
 * Best-effort: a failure is logged and never breaks the page.
 */

const AUTO_ACCEPT_LOG = 'Accepted automatically when the submission window closed — the Program Head had already accepted this subject this term'
const AUTO_DECLINE_REASON = 'Not accepted: the submission window closed and no special exam was accepted for this subject this term.'
const NO_RECEIPT_REASON = 'Not accepted: no payment receipt was uploaded before the exam day.'

/** True for a form this file declined. It was declined because a deadline
 *  passed, so there is nothing for the student to fix and resubmit. */
export function isAutoDeclined(rejectionReason: string | null | undefined): boolean {
  return rejectionReason === AUTO_DECLINE_REASON || rejectionReason === NO_RECEIPT_REASON
}

// The statuses a form reaches once the Program Head has accepted it.
const ACCEPTED = ['accepted', 'receipt_uploaded', 'scheduled']
const PENDING = ['submitted', 'approved_by_teacher']

type Admin = NonNullable<ReturnType<typeof createAdminClient>>

export const runAutoDecisions = cache(async (): Promise<void> => {
  try {
    const period = await getActivePeriodCached()
    if (!period) return
    const win = computeWindow(period.submissionStart, period.windowDays)
    const windowClosed = win.configured && !win.open && !win.notStarted && !!win.end
    const examDayReached = !!period.examDay && Date.now() >= new Date(period.examDay).getTime()
    if (!windowClosed && !examDayReached) return

    const admin = createAdminClient()
    if (!admin) {
      console.warn('[autoDecide] SUPABASE_SERVICE_ROLE_KEY not set — skipped')
      return
    }
    // Emails go out after the response, where a page can no longer read the
    // request's headers — so the site address is read now.
    const base = await siteUrl()

    if (windowClosed) await decideAtWindowClose(admin, period, win.end!, base)
    if (examDayReached) await declineMissingReceipts(admin, period, base)
  } catch (err) {
    console.error('[autoDecide]', err)
  }
})

interface PendingRow {
  id: string
  subject_id: string
  exam_type: string
  didit_id_name: string | null
  snap_name: string | null
  student: { full_name: string } | null
  progress_logs: { action: string | null }[] | null
}

async function decideAtWindowClose(admin: Admin, period: ExamPeriod, windowEnd: string, base: string) {
  const { data: pending, error } = await withSubmissionGate((gate) => {
    let q = admin
      .from('special_exam_requests')
      .select('id, subject_id, exam_type, didit_id_name, snap_name, student:profiles!student_id(full_name), progress_logs(action)')
      .eq('period_id', period.id)
      .in('status', PENDING)
      .lte('submitted_at', windowEnd)
    if (gate) q = q.or(gate)
    return q
  })
  if (error) {
    console.error('[autoDecide] could not read pending forms', error)
    return
  }
  const rows = (pending ?? []) as unknown as PendingRow[]
  if (!rows.length) return

  // Subjects the Program Head accepted a form for this term. A form this
  // function accepted does not count — only a person's decision sets the rule.
  const { data: acceptedRows, error: accErr } = await admin
    .from('special_exam_requests')
    .select('subject_id, progress_logs(action)')
    .eq('period_id', period.id)
    .in('status', ACCEPTED)
  if (accErr) {
    console.error('[autoDecide] could not read accepted forms', accErr)
    return
  }
  const openSubjects = new Set(
    ((acceptedRows ?? []) as { subject_id: string; progress_logs: { action: string | null }[] | null }[])
      .filter((r) => !(r.progress_logs ?? []).some((l) => l.action === AUTO_ACCEPT_LOG))
      .map((r) => r.subject_id),
  )

  const forPH = (r: PendingRow) =>
    isStudentsOwnId(r.didit_id_name, [r.snap_name, r.student?.full_name])
    || (r.progress_logs ?? []).some((l) => l.action?.startsWith(REVERIFY_LOG_PREFIX))
  const decidable = rows.filter((r) => !forPH(r))
  const toAccept = decidable.filter((r) => openSubjects.has(r.subject_id))
  const toDecline = decidable.filter((r) => !openSubjects.has(r.subject_id))

  const excused = await setStatus(admin, toAccept.filter((r) => r.exam_type === 'excused').map((r) => r.id), PENDING, { status: 'scheduled' })
  const paid = await setStatus(admin, toAccept.filter((r) => r.exam_type !== 'excused').map((r) => r.id), PENDING, { status: 'accepted' })
  const declined = await setStatus(admin, toDecline.map((r) => r.id), PENDING, {
    status: 'rejected',
    rejection_reason: AUTO_DECLINE_REASON,
    rejected_by_role: null,
  })

  await log(admin, [
    ...excused.map((id) => ({ id, action: AUTO_ACCEPT_LOG })),
    ...paid.map((id) => ({ id, action: AUTO_ACCEPT_LOG })),
    ...declined.map((id) => ({ id, action: AUTO_DECLINE_REASON })),
  ])

  after(async () => {
    await emailRequestEvent('scheduled', excused, { base, reason: AUTO_ACCEPT_LOG })
    await emailRequestEvent('accepted_paid', paid, { base, reason: AUTO_ACCEPT_LOG })
    await emailRequestEvent('auto_declined', declined, { base, reason: AUTO_DECLINE_REASON })
  })
}

async function declineMissingReceipts(admin: Admin, period: ExamPeriod, base: string) {
  const { data, error } = await admin
    .from('special_exam_requests')
    .update({ status: 'rejected', rejection_reason: NO_RECEIPT_REASON, rejected_by_role: null })
    .eq('period_id', period.id)
    .eq('status', 'accepted')
    .eq('exam_type', 'paid')
    .not('payment_assessed_at', 'is', null)
    .select('id')
  if (error) {
    console.error('[autoDecide] could not decline forms without a receipt', error)
    return
  }
  const ids = (data ?? []).map((r) => r.id as string)
  if (!ids.length) return
  await log(admin, ids.map((id) => ({ id, action: NO_RECEIPT_REASON })))
  after(() => emailRequestEvent('auto_declined', ids, { base, reason: NO_RECEIPT_REASON }))
}

// Updates only the rows still at one of `from`, and returns the ids that
// actually changed — so a form someone else decided meanwhile gets no log line
// and no email.
async function setStatus(admin: Admin, ids: string[], from: string[], values: Record<string, unknown>): Promise<string[]> {
  if (!ids.length) return []
  const { data, error } = await admin
    .from('special_exam_requests')
    .update(values)
    .in('id', ids)
    .in('status', from)
    .select('id')
  if (error) {
    console.error('[autoDecide] update failed', values.status, error)
    return []
  }
  return (data ?? []).map((r) => r.id as string)
}

// The history line on each form. No person did this, so actor_id is null
// (needs supabase/migration_auto_decide.sql); actor_role names the stage it
// stands in for. The decision itself is already saved — a failed log is logged.
async function log(admin: Admin, entries: { id: string; action: string }[]) {
  if (!entries.length) return
  const { error } = await admin.from('progress_logs').insert(
    entries.map((e) => ({ request_id: e.id, actor_id: null, actor_role: 'program_head', action: e.action })),
  )
  if (error) console.error('[autoDecide] history log failed — is migration_auto_decide.sql applied?', error)
}
