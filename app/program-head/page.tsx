import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { keepActive } from '@/lib/examSettings'
import { activePeriodIdCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import PHQueue from './PHQueue'

export const metadata = { title: 'EXAMFLOW — Program Head Queue' }

export default async function ProgramHeadPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      profiles!student_id(full_name, student_number, course, year_level, section),
      subjects(
        subject_code, subject_name,
        profiles!teacher_id(full_name)
      ),
      application_media(id, media_type, storage_path, file_name, mime_type),
      progress_logs(id, action, created_at, actor_role)
    `)
    // First Approval: only requests the teacher just approved. Receipts are
    // handled separately on the Second Approval tab (/program-head/receipts).
    .eq('status', 'approved_by_teacher')
    .order('submitted_at', { ascending: false })

  const activeId = await activePeriodIdCached()
  const requests = keepActive(raw ?? [], activeId).map((r) => {
    const subj = r.subjects as unknown as {
      subject_code: string
      subject_name: string
      profiles: { full_name: string } | null
    }
    const p = r.profiles as unknown as { full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null } | null
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
        teacher: subj?.profiles ?? null,
      },
      // The Program Head reviews the excuse certificate for excused requests.
      // ID / signature are the Registrar's job and are not shown here.
      media: ((r.application_media ?? []) as { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string }[])
        .filter((m) => m.media_type === 'supporting_document'),
      logs: r.progress_logs ?? [],
      resubmitted: ((r.progress_logs ?? []) as { action?: string }[]).some((l) => typeof l.action === 'string' && l.action.startsWith('Resubmitted')),
    }
  })

  return (
    <PHQueue
      requests={requests}
      title="First Approval"
      emptyText="No requests awaiting first approval."
    />
  )
}
