import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import { getSemesterStatRows } from '@/lib/examAnalytics'
import { SEMESTER_LABEL } from '@/lib/examSettings'
import AnalyticsCharts from '@/components/AnalyticsCharts'

export const metadata = { title: 'EXAMFLOW — Analytics' }

// The admin's Analytics charts, limited to the Teacher's own students: RLS
// returns only requests routed to them or for subjects they own, so no filter
// is needed here (an admin acting as Teacher sees every teacher's). Past terms
// need migration_exam_history_teacher.sql.
export default async function TeacherAnalyticsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getMyProfileMeta()
  if (!profile || !['subject_teacher', 'admin'].includes(profile.role)) redirect('/login')

  const supabase = await createClient()
  const { rows, active } = await getSemesterStatRows(supabase)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Analytics</h2>
        <p className="text-sm ef-muted">
          Your students who have taken a special exam{active ? ` in the ${SEMESTER_LABEL[active.semester]}` : ''} — pick how to break it down and switch between pie and bar anytime.
        </p>
      </div>
      <AnalyticsCharts rows={rows} singleDepartment={profile.role !== 'admin'} />
    </div>
  )
}
