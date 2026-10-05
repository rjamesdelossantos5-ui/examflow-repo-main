import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import { getExamStatRows } from '@/lib/examAnalytics'
import AnalyticsCharts from '@/app/admin/analytics/AnalyticsCharts'

export const metadata = { title: 'EXAMFLOW — Analytics' }

// The admin's Analytics charts, limited to the Program Head's own department
// (like their approval queues). An admin opening it has no department, so it
// shows every department. Past terms need migration_exam_history_ph_read.sql.
export default async function ProgramHeadAnalyticsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getMyProfileMeta()
  if (!profile || !['program_head', 'admin'].includes(profile.role)) redirect('/login')

  const supabase = await createClient()
  const rows = await getExamStatRows(supabase, profile.department_id)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Analytics</h2>
        <p className="text-sm ef-muted">
          Students in your department who have taken a special exam — pick how to break it down and switch between pie and bar anytime.
        </p>
      </div>
      <AnalyticsCharts rows={rows} />
    </div>
  )
}
