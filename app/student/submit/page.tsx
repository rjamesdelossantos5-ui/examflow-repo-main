import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SubmitForm from './SubmitForm'
import { getActivePeriod, computeWindow } from '@/lib/examSettings'
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
  // only fixes what was wrong and re-uploads.
  let prefill: Record<string, unknown> | null = null
  if (from) {
    const { data: prev } = await supabase
      .from('special_exam_requests')
      .select('id, status, subject_id, exam_type, excused_reason, other_reason, snap_name, snap_student_number, snap_course, snap_year_level, snap_section')
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
      }
    }
  }

  const [{ data: subjects }, { data: profile }, activePeriod] = await Promise.all([
    supabase.from('subjects').select('id, subject_code, subject_name').order('subject_code'),
    supabase.from('profiles').select('full_name, student_number, course, year_level, section').eq('id', user.id).single(),
    getActivePeriod(supabase),
  ])

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
      subjects={(subjects ?? []) as unknown as Subject[]}
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
    />
  )
}
