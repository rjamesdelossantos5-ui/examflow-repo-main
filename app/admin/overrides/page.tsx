import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OverrideList, { type OverrideRow } from './OverrideList'

export const metadata = { title: 'EXAMFLOW — Override Requests' }

export default async function AdminOverridesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('override_requests')
    .select(`
      id, reason_type, reason_note, status, created_at,
      requester:profiles!requested_by(full_name),
      request:special_exam_requests!request_id(
        snap_name, status,
        student:profiles!student_id(full_name),
        subjects(subject_code, subject_name)
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: OverrideRow[] = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    reasonType: r.reason_type,
    reasonNote: r.reason_note,
    createdAt: r.created_at,
    requestedBy: r.requester?.full_name ?? '—',
    studentName: r.request?.snap_name ?? r.request?.student?.full_name ?? '—',
    subjectCode: r.request?.subjects?.subject_code ?? '',
    subjectName: r.request?.subjects?.subject_name ?? '',
    currentStage: r.request?.status ?? '',
  }))

  return <OverrideList initial={rows} />
}
