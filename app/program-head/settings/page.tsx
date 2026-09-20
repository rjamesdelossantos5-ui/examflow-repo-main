import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActivePeriod, getAllPeriods } from '@/lib/examSettings'
import { getCurrentUser } from '@/lib/currentUser'
import SettingsForm from './SettingsForm'

export const metadata = { title: 'EXAMFLOW — Exam Periods' }

// The End Term action used to sit below this form. It was removed in favour of
// the admin-only reset at /admin/reset — moving to the next term is now done by
// saving that term here, which deactivates the previous one (see savePeriod).
export default async function PHSettingsPage() {
  const supabase = await createClient()
  // Cached — reuses the layout's auth lookup instead of a second round-trip.
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [active, periods] = await Promise.all([getActivePeriod(supabase), getAllPeriods(supabase)])

  return (
    <div className="space-y-8">
      <SettingsForm active={active} periods={periods} />
    </div>
  )
}
