import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewHistoryTable, { type HistoryRow } from '@/components/ReviewHistoryTable'
import { keepActive } from '@/lib/examSettings'
import { activePeriodIdCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — Registrar History' }

export default async function RegistrarHistoryPage() {
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
        subjects(subject_code, subject_name)
      `)
      .in('status', ['verified_by_registrar', 'approved_by_teacher', 'accepted', 'receipt_uploaded', 'scheduled', 'rejected'])
      .order('updated_at', { ascending: false }),
    activePeriodIdCached(),
  ])

  // Only the current term's processed forms — once the PH activates the next
  // term, the previous term's forms drop off this list (they aren't deleted;
  // the rows remain for the student/PH records). Same rule as the queues.
  const rows: HistoryRow[] = keepActive(data ?? [], activeId).map((r) => ({
    id: r.id as string,
    student: (r as { snap_name?: string | null }).snap_name ?? (r.profiles as unknown as { full_name: string })?.full_name ?? '—',
    subject: (r.subjects as unknown as { subject_name: string })?.subject_name ?? '',
    exam_type: r.exam_type as string,
    status: r.status as RequestStatus,
    date: r.submitted_at as string,
    rejection_reason: (r.rejection_reason as string | null) ?? null,
    rejected_by_role: (r.rejected_by_role as string | null) ?? null,
  }))

  return <ReviewHistoryTable title="Verified / Processed History" rows={rows} />
}
