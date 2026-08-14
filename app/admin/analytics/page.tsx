import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import { getExamStatRows } from '@/lib/examAnalytics'
import AnalyticsCharts from './AnalyticsCharts'

export const metadata = { title: 'EXAMFLOW — Analytics' }

export default async function AdminAnalyticsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getMyProfileMeta()
  if (!profile || profile.role !== 'admin') redirect('/login')

  const supabase = await createClient()
  const rows = await getExamStatRows(supabase)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Analytics</h2>
        <p className="text-sm ef-muted">
          Students who have taken a special exam — pick how to break it down and switch between pie and bar anytime.
        </p>
      </div>
      <AnalyticsCharts rows={rows} />
    </div>
  )
}
