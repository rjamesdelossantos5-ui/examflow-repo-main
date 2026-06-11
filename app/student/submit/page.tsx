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

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, subject_code, subject_name')
    .order('subject_code')

  return <SubmitForm subjects={(subjects ?? []) as unknown as Subject[]} error={error} />
}
