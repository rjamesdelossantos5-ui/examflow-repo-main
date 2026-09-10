import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActivePeriod, getAllPeriods, TERM_LABEL, SEMESTER_LABEL } from '@/lib/examSettings'
import { getCurrentUser } from '@/lib/currentUser'
import SettingsForm from './SettingsForm'
import EndTerm from './EndTerm'

export const metadata = { title: 'EXAMFLOW — Exam Periods' }

export default async function PHSettingsPage() {
  const supabase = await createClient()
  // Cached — reuses the layout's auth lookup instead of a second round-trip.
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [active, periods] = await Promise.all([getActivePeriod(supabase), getAllPeriods(supabase)])

  return (
    <div className="space-y-8">
      <SettingsForm active={active} periods={periods} />
      {/* Sits below, and outside, SettingsForm's <form> — it is a separate
          destructive action, not another field. */}
      <EndTerm
        activeTermLabel={active ? `${TERM_LABEL[active.term]} · ${SEMESTER_LABEL[active.semester]}` : null}
      />
    </div>
  )
}
