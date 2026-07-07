import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewHistoryTable, { type HistoryRow } from '@/components/ReviewHistoryTable'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — Registrar History' }

export default async function RegistrarHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      profiles!student_id(full_name),
      subjects(subject_code, subject_name)
    `)
    .in('status', ['verified_by_registrar', 'approved_by_teacher', 'accepted', 'receipt_uploaded', 'scheduled', 'rejected'])
    .order('updated_at', { ascending: false })

  const rows: HistoryRow[] = (data ?? []).map((r) => ({
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
