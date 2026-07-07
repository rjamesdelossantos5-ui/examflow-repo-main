import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { keepActive } from '@/lib/examSettings'
import { activePeriodIdCached } from '@/lib/activePeriod'
import { getMyProfileMeta } from '@/lib/myProfile'
import { keepMyDepartment } from '@/lib/deptFilter'
import PHQueue from '../PHQueue'

export const metadata = { title: 'EXAMFLOW — Second Approval (Receipts)' }

// Second Approval: paid requests where the student has uploaded the cashier
// receipt and is now waiting for the Program Head to verify it. Confirming here
// marks the request Scheduled, which is what puts it on the live Accepted list.
export default async function ProgramHeadReceiptsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      student:profiles!student_id(full_name, student_number, course, year_level, section),
      routed_teacher:profiles!teacher_id(full_name),
      subjects(
        subject_code, subject_name, department_id,
        profiles!teacher_id(full_name)
      ),
      application_media(id, media_type, storage_path, file_name, mime_type),
      progress_logs(id, action, created_at, actor_role)
    `)
    .eq('status', 'receipt_uploaded')
    .order('submitted_at', { ascending: false })

  const [activeId, meta] = await Promise.all([activePeriodIdCached(), getMyProfileMeta()])
  const requests = keepMyDepartment(keepActive(raw ?? [], activeId), meta?.department_id ?? null).map((r) => {
    const subj = r.subjects as unknown as {
      subject_code: string
      subject_name: string
      profiles: { full_name: string } | null
    }
    const p = r.student as unknown as { full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null } | null
    const routedTeacher = r.routed_teacher as unknown as { full_name: string } | null
    const s = r as { snap_name?: string | null; snap_student_number?: string | null; snap_course?: string | null; snap_year_level?: number | null; snap_section?: string | null }
    return {
      ...r,
      student: {
        full_name: s.snap_name ?? p?.full_name ?? '—',
        student_number: s.snap_student_number ?? p?.student_number ?? null,
        course: s.snap_course ?? p?.course ?? null,
        year_level: s.snap_year_level ?? p?.year_level ?? null,
        section: s.snap_section ?? p?.section ?? null,
      },
      subject: {
        subject_code: subj?.subject_code ?? '',
        subject_name: subj?.subject_name ?? '',
        teacher: routedTeacher ?? subj?.profiles ?? null,
      },
      // Second approval only concerns the cashier receipt.
      media: ((r.application_media ?? []) as { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string }[])
        .filter((m) => m.media_type === 'payment_receipt'),
      logs: r.progress_logs ?? [],
    }
  })

  return (
    <PHQueue
      requests={requests}
      title="Second Approval — Verify Receipts"
      emptyText="No payment receipts awaiting verification."
    />
  )
}
