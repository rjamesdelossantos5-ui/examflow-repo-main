import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { keepActive } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import RegistrarQueue from './RegistrarQueue'

export const metadata = { title: 'EXAMFLOW — Registrar Queue' }

export default async function RegistrarPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      profiles!student_id(full_name, student_number, course, year_level, section),
      routed_teacher:profiles!teacher_id(full_name),
      subjects(subject_code, subject_name, profiles!teacher_id(full_name)),
      application_media(id, media_type, storage_path, file_name, mime_type),
      progress_logs(id, action, created_at, actor_role)
    `)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })

  // Only the active term's forms show; the previous term drops off once a new
  // term is activated in Settings.
  const activePeriod = await getActivePeriodCached()
  const activeId = activePeriod?.id ?? null
  const requests = keepActive(raw ?? [], activeId).map((r) => {
    const prof = r.profiles as unknown as { full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null } | null
    const routedTeacher = r.routed_teacher as unknown as { full_name: string } | null
    const subj = r.subjects as unknown as { subject_code: string; subject_name: string; profiles: { full_name: string } | null } | null
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
      teacherName: routedTeacher?.full_name ?? subj?.profiles?.full_name ?? null,
      subject: r.subjects as unknown as { subject_code: string; subject_name: string },
      // Registrar verifies identity documents only. The medical/death certificate
      // is private and shown to the Program Head, not the Registrar.
      media: ((r.application_media ?? []) as { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string }[])
        .filter((m) => ['parent_id', 'parent_id_back', 'parent_signature'].includes(m.media_type)),
      logs: r.progress_logs ?? [],
      resubmitted: ((r.progress_logs ?? []) as { action?: string }[]).some((l) => typeof l.action === 'string' && l.action.startsWith('Resubmitted')),
    }
  })

  return <RegistrarQueue requests={requests} />
}
