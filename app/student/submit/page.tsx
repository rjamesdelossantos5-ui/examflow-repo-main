import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SubmitForm from './SubmitForm'
import { computeWindow, TERM_LABEL } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import type { Subject } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — Submit Request' }

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>
}) {
  const { error, from } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resubmitting a rejected request: pre-fill from its snapshot so the student
  // only fixes what was wrong. Files already on record are kept (existingDocs),
  // so those uploads become optional — upload only to replace.
  let prefill: Record<string, unknown> | null = null
  let existingDocs: string[] = []
  if (from) {
    const { data: prev } = await supabase
      .from('special_exam_requests')
      .select('id, status, subject_id, exam_type, excused_reason, other_reason, snap_name, snap_student_number, snap_course, snap_year_level, snap_section, snap_contact_number')
      .eq('id', from)
      .eq('student_id', user.id)
      .single()
    if (prev && prev.status === 'rejected') {
      prefill = {
        fromId: prev.id,
        subjectId: prev.subject_id,
        examType: prev.exam_type,
        excusedReason: prev.excused_reason,
        otherReason: prev.other_reason,
        fullName: prev.snap_name,
        studentNumber: prev.snap_student_number,
        course: prev.snap_course,
        yearLevel: prev.snap_year_level,
        section: prev.snap_section,
        contactNumber: (prev as { snap_contact_number?: string | null }).snap_contact_number ?? null,
      }
      const { data: prevMedia } = await supabase
        .from('application_media')
        .select('media_type')
        .eq('request_id', prev.id)
      existingDocs = (prevMedia ?? []).map((m) => m.media_type)
    }
  }

  const [{ data: subjects }, { data: profile }, activePeriod] = await Promise.all([
    supabase.from('subjects').select('id, subject_code, subject_name, profiles!teacher_id(full_name)').order('subject_code'),
    supabase.from('profiles').select('full_name, student_number, course, year_level, section').eq('id', user.id).single(),
    getActivePeriodCached(),
  ])

  // Teacher's Name shown on the form is the subject's assigned teacher — the
  // request routes to exactly that teacher.
  const subjRows = (subjects ?? []) as unknown as { id: string; subject_code: string; subject_name: string; profiles: { full_name: string } | null }[]
  const teacherBySubject: Record<string, string> = {}
  for (const s of subjRows) if (s.profiles?.full_name) teacherBySubject[s.id] = s.profiles.full_name
  const subjectList = subjRows.map((s) => ({ id: s.id, subject_code: s.subject_code, subject_name: s.subject_name }))
  const termLabel = activePeriod ? `${TERM_LABEL[activePeriod.term]}${activePeriod.schoolYear ? ` · ${activePeriod.schoolYear}` : ''}` : null

  const win = computeWindow(activePeriod?.submissionStart ?? null, activePeriod?.windowDays ?? 7)
  const open = !!activePeriod && win.open
  const windowMessage = open
    ? null
    : !activePeriod
      ? 'Special exam submissions are not open right now. Please check back later.'
      : win.notStarted
        ? `Submissions open on ${new Date(win.start!).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. You can view your requests in the meantime.`
        : `The submission window has closed${win.end ? ` (ended ${new Date(win.end).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })})` : ''}. You can still view your existing requests.`

  return (
    <SubmitForm
      subjects={subjectList as unknown as Subject[]}
      teacherBySubject={teacherBySubject}
      termLabel={termLabel}
      profile={{
        full_name: profile?.full_name ?? '',
        student_number: profile?.student_number ?? '',
        course: profile?.course ?? '',
        year_level: profile?.year_level ?? null,
        section: profile?.section ?? '',
      }}
      error={error}
      submissionOpen={open}
      windowMessage={windowMessage}
      prefill={prefill as never}
      existingDocs={existingDocs}
    />
  )
}
