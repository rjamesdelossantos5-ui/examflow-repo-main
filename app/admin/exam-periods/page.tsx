import { createClient } from '@/lib/supabase/server'
import { getActivePeriod, getAllPeriods } from '@/lib/examSettings'
import SettingsForm from '@/app/program-head/settings/SettingsForm'

export const metadata = { title: 'EXAMFLOW Admin — Exam Periods' }

// The same Exam Periods form the Program Head uses (/program-head/settings):
// the term, the submission window and the exam date. Its server actions
// (savePeriod, saveExamSchedule, setActivePeriod, deletePeriod in
// app/program-head/actions.ts) already accept 'admin', and the exam_periods
// policies allow admins to write.
export default async function AdminExamPeriodsPage() {
  const supabase = await createClient()
  const [active, periods] = await Promise.all([getActivePeriod(supabase), getAllPeriods(supabase)])

  return (
    <div className="space-y-8">
      <SettingsForm active={active} periods={periods} />
    </div>
  )
}
