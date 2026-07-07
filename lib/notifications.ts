import type { NotificationItem } from '@/components/NotificationBell'
import type { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/supabase/types'
import { getActivePeriodCached, activePeriodIdCached } from '@/lib/activePeriod'
import { getMyDeptSubjectIds } from '@/lib/myProfile'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

// Cheap indexed count of requests at a given status — used for the nav-tab
// badges. Counts only the active term (plus legacy null-period rows) so the
// badge matches the (filtered) queue below it.
export async function countByStatus(
  supabase: SupabaseServer,
  status: string,
  subjectIds?: string[] | null,
): Promise<number> {
  // A dept-scoped caller (Program Head) passes their department's subject ids.
  // Empty array = department has no subjects yet = nothing to count.
  if (Array.isArray(subjectIds) && subjectIds.length === 0) return 0

  const activeId = await activePeriodIdCached()
  let q = supabase
    .from('special_exam_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', status)
  if (activeId) q = q.or(`period_id.is.null,period_id.eq.${activeId}`)
  if (subjectIds && subjectIds.length) q = q.in('subject_id', subjectIds)
  const { count } = await q
  return count ?? 0
}

// Pending admin-override requests — used for the admin nav-tab badge.
export async function countPendingOverrides(supabase: SupabaseServer): Promise<number> {
  const { count } = await supabase
    .from('override_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  return count ?? 0
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
  ): Promise<NotificationItem[]> => {
    if (Array.isArray(subjectIds) && subjectIds.length === 0) return []
    let q = supabase
      .from('special_exam_requests')
      .select('id, snap_name, profiles!student_id(full_name), subjects(subject_code)')
      .eq('status', status)
      .order('submitted_at', { ascending: false })
      .limit(MAX_ITEMS)
    if (activeId) q = q.or(`period_id.is.null,period_id.eq.${activeId}`)
    if (subjectIds && subjectIds.length) q = q.in('subject_id', subjectIds)
    const { data } = await q

    return ((data ?? []) as unknown as QueueRow[]).map((r) => ({
      id: r.id,
      text: text(r.snap_name ?? r.profiles?.full_name ?? 'A student', r.subjects?.subject_code ?? 'a subject'),
      href: `${basePath}?req=${r.id}`,
      tone,
      icon,
    }))
  }

  if (role === 'registrar') {
    return queueItems('submitted', '/registrar', (name, code) => `${name} submitted a request for ${code}.`, 'info', 'inbox')
  }

  if (role === 'subject_teacher') {
    return queueItems('verified_by_registrar', '/teacher', (name, code) => `${name}'s request for ${code} is ready for your approval.`, 'info', 'inbox')
  }

  if (role === 'program_head') {
    // Scope the PH bell to their own department's subjects.
    const deptIds = await getMyDeptSubjectIds()
    const [first, second] = await Promise.all([
      queueItems('approved_by_teacher', '/program-head', (name, code) => `${name} — ${code} is awaiting first approval.`, 'info', 'inbox', deptIds),
      queueItems('receipt_uploaded', '/program-head/receipts', (name, code) => `${name} uploaded a payment receipt for ${code}.`, 'warning', 'receipt', deptIds),
    ])

    // "Your override request was approved" — only while the request is still
    // overridable (drops off once the PH has accepted it).
    type OvRow = { id: string; request: { status: string; snap_name: string | null; student: { full_name: string } | null } | null }
    const { data: appr } = await supabase
      .from('override_requests')
      .select('id, request:special_exam_requests!request_id(status, snap_name, student:profiles!student_id(full_name))')
      .eq('requested_by', userId)
      .eq('status', 'approved')
      .order('decided_at', { ascending: false })
      .limit(MAX_ITEMS)
    const approved: NotificationItem[] = ((appr ?? []) as unknown as OvRow[])
      .filter((r) => ['submitted', 'verified_by_registrar', 'approved_by_teacher'].includes(r.request?.status ?? ''))
      .map((r) => ({
        id: `ov-${r.id}`,
        text: `Your override request for ${r.request?.snap_name ?? r.request?.student?.full_name ?? 'a student'} was approved — you can accept it now.`,
        href: '/program-head/overview',
        tone: 'success',
        icon: 'check',
      }))

    return [...first, ...second, ...approved]
  }

  // Admin: Program Heads asking to fast-track a stuck request.
  if (role === 'admin') {
    type OvAdminRow = { id: string; requester: { full_name: string } | null; request: { snap_name: string | null; student: { full_name: string } | null } | null }
    const { data } = await supabase
      .from('override_requests')
      .select('id, requester:profiles!requested_by(full_name), request:special_exam_requests!request_id(snap_name, student:profiles!student_id(full_name))')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS)
    return ((data ?? []) as unknown as OvAdminRow[]).map((r) => ({
      id: r.id,
      text: `${r.requester?.full_name ?? 'A Program Head'} requested an override for ${r.request?.snap_name ?? r.request?.student?.full_name ?? 'a student'}.`,
      href: '/admin/overrides',
      tone: 'warning' as const,
      icon: 'inbox' as const,
    }))
  }

  // Students: one alert per update on their own requests (someone acted on it),
  // newest change first. The bell badge clears once opened and stays cleared
  // (even across a re-login) until something with a newer timestamp shows up —
  // see notifications_seen_at, set by markNotificationsSeen().
  if (role === 'student') {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('notifications_seen_at')
      .eq('id', userId)
      .single()
    const seenAt = (profileRow as { notifications_seen_at: string | null } | null)?.notifications_seen_at
    const seenMs = seenAt ? new Date(seenAt).getTime() : 0

    const { data: allData } = await supabase
      .from('special_exam_requests')
      .select('id, status, exam_type, updated_at, period_id, subjects(subject_code)')
      .eq('student_id', userId)
      .in('status', ['accepted', 'scheduled', 'rejected', 'submitted', 'verified_by_registrar', 'approved_by_teacher', 'receipt_uploaded'])
      .order('updated_at', { ascending: false })
      .limit(MAX_ITEMS)
    const data = (allData ?? []).filter((r) => new Date(r.updated_at).getTime() > seenMs)

    const items: NotificationItem[] = []

    // Top item: the special-exam schedule was set for the term this student is
    // taking part in (only while they still have a live request in it, and only
    // while it's newer than the student's last-seen mark).
    const active = await getActivePeriodCached()
    if (active?.examDay && active.scheduleUpdatedAt && new Date(active.scheduleUpdatedAt).getTime() > seenMs) {
      const hasLiveRequest = (allData ?? []).some(
        (r) => r.status !== 'rejected' && (!r.period_id || r.period_id === active.id),
      )
      if (hasLiveRequest) {
        const when = new Date(active.examDay).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
        items.push({
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
      if (r.status === 'accepted' && r.exam_type === 'paid')
        items.push({ id: r.id, text: `Action needed: upload your payment receipt for ${code}.`, href, tone: 'warning', icon: 'receipt' })
      else if (r.status === 'accepted')
        items.push({ id: r.id, text: `Your request for ${code} was approved.`, href, tone: 'success', icon: 'check' })
      else if (r.status === 'scheduled')
        items.push({ id: r.id, text: `Your special exam for ${code} is scheduled.`, href, tone: 'success', icon: 'calendar' })
      else if (r.status === 'rejected')
        items.push({ id: r.id, text: `Your request for ${code} was rejected.`, href, tone: 'danger', icon: 'x-circle' })
    }

    return items
  }

  return []
}
