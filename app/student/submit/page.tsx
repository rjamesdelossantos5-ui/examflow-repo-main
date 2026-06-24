import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SubmitForm from './SubmitForm'
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

  const [{ data: subjects }, { data: profile }] = await Promise.all([
    supabase.from('subjects').select('id, subject_code, subject_name').order('subject_code'),
    supabase.from('profiles').select('full_name, student_number, course, year_level, section').eq('id', user.id).single(),
  ])

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
    />
  )
}
