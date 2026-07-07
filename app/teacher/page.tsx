import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { keepActive, computeWindow, TERM_LABEL } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import StaffWindowBanner from '@/components/StaffWindowBanner'
import TeacherQueue from './TeacherQueue'

export const metadata = { title: 'EXAMFLOW — Teacher Queue' }

export default async function TeacherPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      profiles!student_id(full_name, student_number, course, year_level, section),
      subjects!inner(subject_code, subject_name, teacher_id),
      application_media(id, media_type, storage_path, file_name, mime_type),
      progress_logs(id, action, created_at, actor_role)
    `)
    .eq('status', 'verified_by_registrar')
    .order('submitted_at', { ascending: false })

  // RLS already filters by teacher. Media isn't shown to teachers, but we pass
  // it through; signed URLs are fetched lazily where documents are viewable.
  const activePeriod = await getActivePeriodCached()
  const activeId = activePeriod?.id ?? null
  const win = computeWindow(activePeriod?.submissionStart ?? null, activePeriod?.windowDays ?? 7)
  const requests = keepActive(raw ?? [], activeId).map((r) => {
    const prof = r.profiles as unknown as { full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null } | null
    const s = r as {
      snap_name?: string | null; snap_student_number?: string | null; snap_course?: string | null
      snap_year_level?: number | null; snap_section?: string | null; snap_contact_number?: string | null
    }
    return {
      ...r,
      student: {
        full_name: s.snap_name ?? prof?.full_name ?? '—',
        student_number: s.snap_student_number ?? prof?.student_number ?? null,
        course: s.snap_course ?? prof?.course ?? null,
        year_level: s.snap_year_level ?? prof?.year_level ?? null,
        section: s.snap_section ?? prof?.section ?? null,
        contact_number: s.snap_contact_number ?? null,
      },
      subject: r.subjects as unknown as { subject_code: string; subject_name: string },
      media: (r.application_media ?? []) as { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string }[],
      logs: r.progress_logs ?? [],
      resubmitted: ((r.progress_logs ?? []) as { action?: string }[]).some((l) => typeof l.action === 'string' && l.action.startsWith('Resubmitted')),
    }
  })

  return (
    <>
      <StaffWindowBanner
        termLabel={activePeriod ? TERM_LABEL[activePeriod.term] : null}
        open={win.open}
        notStarted={win.notStarted}
        daysRemaining={win.daysRemaining}
        end={win.end}
      />
      <TeacherQueue requests={requests} />
    </>
  )
}
