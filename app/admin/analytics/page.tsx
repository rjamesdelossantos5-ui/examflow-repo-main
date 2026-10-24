import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import { getExamStatRows } from '@/lib/examAnalytics'
import { getActivePeriod, SEMESTER_LABEL } from '@/lib/examSettings'
import AnalyticsCharts from './AnalyticsCharts'
import { displayName, surname } from '@/lib/initials'

export const metadata = { title: 'EXAMFLOW — Analytics' }

export default async function AdminAnalyticsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getMyProfileMeta()
  if (!profile || profile.role !== 'admin') redirect('/login')

  const supabase = await createClient()
  const [allRows, active] = await Promise.all([getExamStatRows(supabase), getActivePeriod(supabase)])
  // The counts restart when the active semester changes (1st → 2nd): only the
  // active period's semester is counted. With no active period there is nothing
  // to scope to, so every row is shown.
  const rows = active ? allRows.filter((r) => r.semester === active.semester) : allRows

  return (
    <div className="space-y-5">
      {/* Greeting styled like the student dashboard's (app/student/page.tsx). */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Welcome, {displayName(surname(profile.full_name))}
        </h1>
        <h2 className="text-base font-semibold mt-3" style={{ color: 'var(--foreground)' }}>Analytics</h2>
        <p className="text-sm ef-muted">
          Students who have taken a special exam{active ? ` in the ${SEMESTER_LABEL[active.semester]}` : ''} — pick how to break it down and switch between pie and bar anytime.
        </p>
      </div>
      <AnalyticsCharts rows={rows} />
    </div>
  )
}
