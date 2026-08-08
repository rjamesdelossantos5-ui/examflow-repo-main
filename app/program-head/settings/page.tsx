import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActivePeriod, getAllPeriods } from '@/lib/examSettings'
import { getCurrentUser } from '@/lib/currentUser'
import SettingsForm from './SettingsForm'

export const metadata = { title: 'EXAMFLOW — Exam Periods' }

export default async function PHSettingsPage() {
  const supabase = await createClient()
  // Cached — reuses the layout's auth lookup instead of a second round-trip.
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [active, periods] = await Promise.all([getActivePeriod(supabase), getAllPeriods(supabase)])

  return <SettingsForm active={active} periods={periods} />
}
