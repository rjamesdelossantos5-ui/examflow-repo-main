import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewHistoryTable, { type HistoryRow } from '@/components/ReviewHistoryTable'
import { keepActive } from '@/lib/examSettings'
import { activePeriodIdCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import type { RequestStatus } from '@/lib/supabase/types'

// The log line approveRequest / approveAll write (app/teacher/actions.ts).
const TEACHER_APPROVED = 'Approved by Subject Teacher'

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
        profiles!student_id(full_name, student_number, course, year_level, section),
        subjects!inner(subject_code, subject_name, teacher_id),
        progress_logs(id, action, created_at, actor_role)
      `)
      .in('status', ['approved_by_teacher', 'accepted', 'receipt_uploaded', 'scheduled', 'rejected'])
      .order('updated_at', { ascending: false }),
    activePeriodIdCached(),
  ])

  // Only the current term (dropped off when the PH activates the next term).
  const rows: HistoryRow[] = keepActive(data ?? [], activeId)
    // Only show rejections the teacher made (older rows — the teacher can no
    // longer reject), not the Program Head's.
    .filter((r) => r.status !== 'rejected' || r.rejected_by_role === 'subject_teacher')
    .map((r) => {
      // What the student entered on the form wins over their account, like the
      // other staff pages.
      const s = r as {
        snap_name?: string | null; snap_student_number?: string | null; snap_course?: string | null
        snap_year_level?: number | null; snap_section?: string | null; snap_contact_number?: string | null
      }
      const prof = r.profiles as unknown as {
        full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null
      } | null
      // When the teacher approved it: the log entry (written by the teacher, or
      // by an admin acting as one). The latest, in case it was approved twice.
      const approvedAt = ((r.progress_logs ?? []) as { action: string; created_at: string }[])
        .filter((l) => l.action.startsWith(TEACHER_APPROVED))
        .map((l) => l.created_at)
        .sort()
        .pop() ?? null
      return {
        id: r.id as string,
        student: s.snap_name ?? prof?.full_name ?? '—',
        subject: (r.subjects as unknown as { subject_name: string })?.subject_name ?? '',
        exam_type: r.exam_type as string,
        status: r.status as RequestStatus,
        date: r.submitted_at as string,
        rejection_reason: (r.rejection_reason as string | null) ?? null,
        rejected_by_role: (r.rejected_by_role as string | null) ?? null,
        detail: {
          name: s.snap_name ?? prof?.full_name ?? '—',
          studentNumber: s.snap_student_number ?? prof?.student_number ?? null,
          course: s.snap_course ?? prof?.course ?? null,
          yearLevel: s.snap_year_level ?? prof?.year_level ?? null,
          section: s.snap_section ?? prof?.section ?? null,
          contact: s.snap_contact_number ?? null,
          approvedAt,
        },
      }
    })

  return <ReviewHistoryTable title="Reviewed History" rows={rows} />
}
