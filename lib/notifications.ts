import type { NotificationItem } from '@/components/NotificationBell'
import type { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/supabase/types'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

// Cheap indexed count of requests at a given status — used for the nav-tab badges.
export async function countByStatus(supabase: SupabaseServer, status: string): Promise<number> {
  const { count } = await supabase
    .from('special_exam_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', status)
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
  const queueItems = async (
    status: string,
    basePath: string,
    text: (name: string, code: string) => string,
    tone: NotificationItem['tone'],
    icon: NotificationItem['icon'],
  ): Promise<NotificationItem[]> => {
    const { data } = await supabase
      .from('special_exam_requests')
      .select('id, snap_name, profiles!student_id(full_name), subjects(subject_code)')
      .eq('status', status)
      .order('submitted_at', { ascending: false })
      .limit(MAX_ITEMS)

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
    const [first, second] = await Promise.all([
      queueItems('approved_by_teacher', '/program-head', (name, code) => `${name} — ${code} is awaiting first approval.`, 'info', 'inbox'),
      queueItems('receipt_uploaded', '/program-head/receipts', (name, code) => `${name} uploaded a payment receipt for ${code}.`, 'warning', 'receipt'),
    ])
    return [...first, ...second]
  }

  // Students: one alert per update on their own requests (someone acted on it).
  if (role === 'student') {
    const { data } = await supabase
      .from('special_exam_requests')
      .select('id, status, exam_type, subjects(subject_code)')
      .eq('student_id', userId)
      .in('status', ['accepted', 'scheduled', 'rejected'])
      .order('submitted_at', { ascending: false })
      .limit(MAX_ITEMS)

    return (data ?? []).map((r): NotificationItem => {
      const code = (r.subjects as unknown as { subject_code: string } | null)?.subject_code ?? 'your subject'
      const href = `/student/requests/${r.id}`
      if (r.status === 'accepted' && r.exam_type === 'paid')
        return { id: r.id, text: `Action needed: upload your payment receipt for ${code}.`, href, tone: 'warning', icon: 'receipt' }
      if (r.status === 'accepted')
        return { id: r.id, text: `Your request for ${code} was approved.`, href, tone: 'success', icon: 'check' }
      if (r.status === 'scheduled')
        return { id: r.id, text: `Your special exam for ${code} is scheduled.`, href, tone: 'success', icon: 'calendar' }
      return { id: r.id, text: `Your request for ${code} was rejected.`, href, tone: 'danger', icon: 'x-circle' }
    })
  }

  return []
}
