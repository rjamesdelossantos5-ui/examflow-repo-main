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

  const SELECT = `
      *,
      profiles!student_id(full_name, student_number, course, year_level, section),
      routed_teacher:profiles!teacher_id(full_name),
      subjects(subject_code, subject_name, profiles!teacher_id(full_name)),
      application_media(id, media_type, storage_path, file_name, mime_type),
      progress_logs(id, action, created_at, actor_role)
    `

  // A request only reaches the Registrar once the parent's identity has been
  // verified. Filling in the form is no longer enough to enter the queue —
  // otherwise the Registrar could verify and forward a request whose parent was
  // never actually present, which is the whole point of the check.
  //
  // NULL is included deliberately: those are requests submitted before this
  // feature existed. They have no verification to wait for, and excluding them
  // would silently strand every in-flight request the day this ships. New
  // requests are stamped 'Not Started' at submission, so they are held back
  // until Didit reports 'Approved' (see app/student/submit/actions.ts).
  const verified = await supabase
    .from('special_exam_requests')
    .select(SELECT)
    .eq('status', 'submitted')
    // Two conditions, not one: the parent must have passed verification AND the
    // student must have pressed Submit afterwards. Passing verification alone
    // does not submit a request — see migration_confirm_submit.sql.
    .or('didit_status.is.null,and(didit_status.eq.Approved,student_confirmed_at.not.is.null)')
    .order('submitted_at', { ascending: false })

  let raw = verified.data

  // migration_didit.sql not applied yet — didit_status doesn't exist, so the
  // filter above errors and would leave the Registrar staring at an empty queue
  // with no explanation. Fall back to the unfiltered query: without the column
  // there is no verification to gate on anyway, so this is the pre-Didit
  // behaviour rather than a silent outage. Same guard as savePeriod().
  // Degrade one step at a time rather than straight to "show everything".
  // A missing column makes PostgREST error, which would otherwise leave the
  // Registrar staring at an empty queue with no explanation.
  if (verified.error) {
    console.error('[registrar] confirm filter unavailable — is migration_confirm_submit.sql applied?', verified.error)
    // student_confirmed_at may be missing; didit_status alone still gates on
    // whether the parent passed, which is the more important of the two.
    const diditOnly = await supabase
      .from('special_exam_requests')
      .select(SELECT)
      .eq('status', 'submitted')
      .or('didit_status.is.null,didit_status.eq.Approved')
      .order('submitted_at', { ascending: false })
    raw = diditOnly.data

    if (diditOnly.error) {
      console.error('[registrar] verification filter unavailable — is migration_didit.sql applied?', diditOnly.error)
      const unfiltered = await supabase
        .from('special_exam_requests')
        .select(SELECT)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
      raw = unfiltered.data
    }
  }

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
