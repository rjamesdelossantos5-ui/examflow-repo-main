import type { NotificationItem } from '@/components/NotificationBell'
import type { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/supabase/types'
import { getActivePeriodCached, activePeriodIdCached } from '@/lib/activePeriod'
import { computeWindow, TERM_LABEL } from '@/lib/examSettings'
import { getMyDeptSubjectIds } from '@/lib/myProfile'
import { withRegistrarGate } from '@/lib/registrarGate'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

// Cheap indexed count of requests at a given status — used for the nav-tab
// badges. Counts only the active term (plus legacy null-period rows) so the
// badge matches the (filtered) queue below it.
export async function countByStatus(
  supabase: SupabaseServer,
  status: string,
  subjectIds?: string[] | null,
  /** Apply the Registrar gate (lib/registrarGate.ts), as the queue under this
   *  badge does. The Program Head's First Approval needs it: a request returned
   *  for re-verification stays 'approved_by_teacher' while the parent verifies
   *  again, and must not be counted until it is back. */
  gated = false,
): Promise<number> {
  // A dept-scoped caller (Program Head) passes their department's subject ids.
  // Empty array = department has no subjects yet = nothing to count.
  if (Array.isArray(subjectIds) && subjectIds.length === 0) return 0

  const activeId = await activePeriodIdCached()
  const run = (gate: string | null) => {
    let q = supabase
      .from('special_exam_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
    if (activeId) q = q.or(`period_id.is.null,period_id.eq.${activeId}`)
    if (subjectIds && subjectIds.length) q = q.in('subject_id', subjectIds)
    if (gate) q = q.or(gate)
    return q
  }
  const { count } = gated ? await withRegistrarGate(run) : await run(null)
  return count ?? 0
}

// The Registrar's nav badge. countByStatus('submitted') counted every row at
// that status — including forms whose parent had not been verified and that the
// student had not submitted — so the badge said 3 over an empty queue. This
// counts through the same gate as the queue itself (lib/registrarGate.ts).
export async function countRegistrarPending(supabase: SupabaseServer): Promise<number> {
  const activeId = await activePeriodIdCached()
  const { count } = await withRegistrarGate((gate) => {
    let q = supabase
      .from('special_exam_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted')
    if (activeId) q = q.or(`period_id.is.null,period_id.eq.${activeId}`)
    // A second .or() is ANDed with the first — PostgREST combines repeated or
    // params, verified against this database before relying on it.
    if (gate) q = q.or(gate)
    return q
  })
  return count ?? 0
}

// Forms waiting on someone at any step (Registrar, Teacher, Program Head first
// and second approval) — the admin's Requests nav-tab badge. Each count goes
// through the same gate as its queue, so the badge matches what is listed.
export async function countWaitingForAnyone(supabase: SupabaseServer): Promise<number> {
  const counts = await Promise.all([
    countRegistrarPending(supabase),
    countByStatus(supabase, 'verified_by_registrar'),
    countByStatus(supabase, 'approved_by_teacher', null, true),
    countByStatus(supabase, 'receipt_uploaded'),
  ])
  return counts.reduce((a, b) => a + b, 0)
}

// Upper bound per query so the payload can't grow without limit (safety for
// low-end phones). The bell dropdown is height-capped + scrollable, so users
// can scroll through all of these — none are hidden until this ceiling, which
// is set high enough that a real queue won't reach it.
const MAX_ITEMS = 50

interface QueueRow {
  id: string
  snap_name: string | null
  profiles: { full_name: string } | null
  subjects: { subject_code: string } | null
}

export async function getNotifications(
  supabase: SupabaseServer,
  userId: string,
  role: UserRole,
): Promise<NotificationItem[]> {
  // One alert per pending request in a reviewer's queue (newest first). The
  // href carries ?req=<id> so the queue opens straight to that request's
  // accept/reject panel instead of just landing on the page.
  // Previous-term requests drop off the reviewer queues, so their alerts should
  // drop off the bell too (keeps the bell in step with the queue + badge).
  const activeId = role === 'student' ? null : await activePeriodIdCached()

  const queueItems = async (
    status: string,
    basePath: string,
    text: (name: string, code: string) => string,
    tone: NotificationItem['tone'],
    icon: NotificationItem['icon'],
    subjectIds?: string[] | null,
    /** Apply the Registrar gate (lib/registrarGate.ts). Without it the bell
     *  announced "X submitted a request" for forms not yet submitted. */
    gated = false,
  ): Promise<NotificationItem[]> => {
    if (Array.isArray(subjectIds) && subjectIds.length === 0) return []
    const run = (gate: string | null) => {
      let q = supabase
        .from('special_exam_requests')
        .select('id, snap_name, profiles!student_id(full_name), subjects(subject_code)')
        .eq('status', status)
        .order('submitted_at', { ascending: false })
        .limit(MAX_ITEMS)
      if (activeId) q = q.or(`period_id.is.null,period_id.eq.${activeId}`)
      if (subjectIds && subjectIds.length) q = q.in('subject_id', subjectIds)
      if (gate) q = q.or(gate)
      return q
    }
    const { data } = gated ? await withRegistrarGate(run) : await run(null)

    return ((data ?? []) as unknown as QueueRow[]).map((r) => ({
      id: r.id,
      text: text(r.snap_name ?? r.profiles?.full_name ?? 'A student', r.subjects?.subject_code ?? 'a subject'),
      href: `${basePath}?req=${r.id}`,
      tone,
      icon,
    }))
  }

  if (role === 'registrar') {
    return queueItems('submitted', '/registrar', (name, code) => `${name} submitted a request for ${code}.`, 'info', 'inbox', null, true)
  }

  if (role === 'subject_teacher') {
    return queueItems('verified_by_registrar', '/teacher', (name, code) => `${name}'s request for ${code} is ready for your approval.`, 'info', 'inbox')
  }

  if (role === 'program_head') {
    // Scope the PH bell to their own department's subjects.
    const deptIds = await getMyDeptSubjectIds()
    const [first, second] = await Promise.all([
      // Gated for the same reason as the queue: a request returned for
      // re-verification is not awaiting the Program Head until it is back.
      queueItems('approved_by_teacher', '/program-head', (name, code) => `${name} — ${code} is awaiting first approval.`, 'info', 'inbox', deptIds, true),
      queueItems('receipt_uploaded', '/program-head/receipts', (name, code) => `${name} uploaded a payment receipt for ${code}.`, 'warning', 'receipt', deptIds),
    ])

    return [...first, ...second]
  }

  // Admin: every form waiting on someone, at every step and in every
  // department — each links to the page where that step is done, which the
  // admin may use as that role.
  if (role === 'admin') {
    const [registrar, teacher, first, second] = await Promise.all([
      queueItems('submitted', '/registrar', (name, code) => `${name} — ${code} is waiting for the Registrar.`, 'info', 'inbox', null, true),
      queueItems('verified_by_registrar', '/teacher', (name, code) => `${name} — ${code} is waiting for the Teacher.`, 'info', 'inbox'),
      queueItems('approved_by_teacher', '/program-head', (name, code) => `${name} — ${code} is waiting for the Program Head's first approval.`, 'info', 'inbox', null, true),
      queueItems('receipt_uploaded', '/program-head/receipts', (name, code) => `${name} uploaded a payment receipt for ${code}.`, 'warning', 'receipt'),
    ])
    return [...registrar, ...teacher, ...first, ...second]
  }

  // Students: the latest status of each of their recent requests, newest change
  // first. Items stay in the list after the bell is opened; the ones that changed
  // since it was last opened are marked unread and counted on the badge — see
  // notifications_seen_at, set by markNotificationsSeen().
  if (role === 'student') {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('notifications_seen_at')
      .eq('id', userId)
      .single()
    const seenAt = (profileRow as { notifications_seen_at: string | null } | null)?.notifications_seen_at
    const seenMs = seenAt ? new Date(seenAt).getTime() : 0

    // '*' rather than a column list: the returned-for-re-verification check below
    // reads student_confirmed_at, which only exists once
    // migration_confirm_submit.sql has run — naming it would break the whole
    // bell on a database without it, where '*' just leaves it undefined.
    const { data: allData } = await supabase
      .from('special_exam_requests')
      .select('*, subjects(subject_code)')
      .eq('student_id', userId)
      .in('status', ['accepted', 'scheduled', 'rejected', 'submitted', 'verified_by_registrar', 'approved_by_teacher', 'receipt_uploaded'])
      .order('updated_at', { ascending: false })
      .limit(MAX_ITEMS)
    const data = allData ?? []
    const isNew = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() > seenMs

    const items: NotificationItem[] = []

    const active = await getActivePeriodCached()

    // Submission window just opened for this term — "new" if it opened after
    // the student last checked the bell (submissionStart is the moment it
    // became open).
    if (active) {
      const win = computeWindow(active.submissionStart, active.windowDays)
      // configured rules out a term whose window has not been set yet: there
      // is no "it just opened" moment to compare against, and computeWindow
      // reports open:true for a null date (its no-period fallback).
      if (win.configured && win.open) {
        items.push({
          unread: new Date(active.submissionStart + 'T00:00:00').getTime() > seenMs,
          id: `open-${active.id}`,
          text: `${TERM_LABEL[active.term]} submissions are now open. You have ${win.daysRemaining} day${win.daysRemaining === 1 ? '' : 's'} to submit (closes ${win.end ? new Date(win.end).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}).`,
          href: '/student/submit',
          tone: 'success',
          icon: 'calendar',
        })
      }
    }

    // The special-exam schedule was set for the term this student is taking
    // part in (only while they still have a live request in it; unread while
    // it's newer than the student's last-seen mark).
    if (active?.examDay && active.scheduleUpdatedAt) {
      const hasLiveRequest = (allData ?? []).some(
        (r) => r.status !== 'rejected' && (!r.period_id || r.period_id === active.id),
      )
      if (hasLiveRequest) {
        const when = new Date(active.examDay).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
        items.push({
          unread: isNew(active.scheduleUpdatedAt),
          id: `sched-${active.id}`,
          text: `The special exam is scheduled for ${when}. Remember to get and fill out the form from the Registrar.`,
          href: '/student',
          tone: 'info',
          icon: 'calendar',
        })
      }
    }

    for (const r of data) {
      const code = (r.subjects as unknown as { subject_code: string } | null)?.subject_code ?? 'your subject'
      const href = `/student/requests/${r.id}`
      const unread = isNew(r.updated_at)
      if (r.status === 'accepted' && r.exam_type === 'paid')
        items.push({ unread, id: r.id, text: `Action needed: upload your payment receipt for ${code}.`, href, tone: 'warning', icon: 'receipt' })
      else if (r.status === 'accepted')
        items.push({ unread, id: r.id, text: `Your request for ${code} was approved.`, href, tone: 'success', icon: 'check' })
      else if (r.status === 'scheduled')
        items.push({ unread, id: r.id, text: `Your special exam for ${code} is scheduled.`, href, tone: 'success', icon: 'calendar' })
      else if (r.status === 'rejected')
        items.push({ unread, id: r.id, text: `Your request for ${code} was rejected.`, href, tone: 'danger', icon: 'x-circle' })
      // Returned by the Program Head for re-verification: still at first
      // approval, but the parent's verification was cleared. Nothing else leaves
      // an 'approved_by_teacher' request unconfirmed (see lib/registrarGate.ts).
      else if (r.status === 'approved_by_teacher' && r.didit_status && !r.student_confirmed_at)
        items.push({ unread, id: r.id, text: `Action needed: your Program Head asked your parent or guardian to verify again for ${code}.`, href, tone: 'warning', icon: 'user' })
    }

    return items
  }

  return []
}
