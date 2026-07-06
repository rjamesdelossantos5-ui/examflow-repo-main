import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SubmitForm from './SubmitForm'
import { getExamSettings, computeWindow } from '@/lib/examSettings'
import type { Subject } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — Submit Request' }

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: subjects }, { data: profile }, settings] = await Promise.all([
    supabase.from('subjects').select('id, subject_code, subject_name').order('subject_code'),
    supabase.from('profiles').select('full_name, student_number, course, year_level, section').eq('id', user.id).single(),
    getExamSettings(supabase),
  ])

  const win = computeWindow(settings.submissionStart, settings.windowDays)
  const windowMessage = win.open
    ? null
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
      submissionOpen={win.open}
      windowMessage={windowMessage}
    />
  )
}
