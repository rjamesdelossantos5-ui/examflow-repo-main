import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewHistoryTable, { type HistoryRow } from '@/components/ReviewHistoryTable'
import { keepActive } from '@/lib/examSettings'
import { activePeriodIdCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — Teacher History' }

export default async function TeacherHistoryPage() {
  const supabase = await createClient()
  // Cached — reuses the layout's auth lookup instead of a second round-trip.
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [{ data }, activeId] = await Promise.all([
    supabase
      .from('special_exam_requests')
      .select(`
        *,
        profiles!student_id(full_name),
        subjects!inner(subject_code, subject_name, teacher_id)
      `)
      .in('status', ['approved_by_teacher', 'accepted', 'receipt_uploaded', 'scheduled', 'rejected'])
      .order('updated_at', { ascending: false }),
    activePeriodIdCached(),
  ])

  // Only the current term (dropped off when the PH activates the next term).
  const rows: HistoryRow[] = keepActive(data ?? [], activeId)
    // A form the Registrar rejected never reached the teacher — it stays in the
    // Registrar's history, not here. Only show rejections the teacher made.
    .filter((r) => r.status !== 'rejected' || r.rejected_by_role === 'subject_teacher')
    .map((r) => ({
      id: r.id as string,
      student: (r as { snap_name?: string | null }).snap_name ?? (r.profiles as unknown as { full_name: string })?.full_name ?? '—',
      subject: (r.subjects as unknown as { subject_name: string })?.subject_name ?? '',
      exam_type: r.exam_type as string,
      status: r.status as RequestStatus,
      date: r.submitted_at as string,
      rejection_reason: (r.rejection_reason as string | null) ?? null,
      rejected_by_role: (r.rejected_by_role as string | null) ?? null,
    }))

  return <ReviewHistoryTable title="Reviewed History" rows={rows} />
}
