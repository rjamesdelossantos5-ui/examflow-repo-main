import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { getRoleDashboard } from '@/lib/roleDashboard'
import RoleDashboard from '@/components/RoleDashboard'

export const metadata = { title: 'EXAMFLOW — Teacher Dashboard' }

// RLS limits a Teacher to requests for their own subjects, so the counts are
// theirs without any filter here (an admin acting as Teacher sees every teacher's).
export default async function TeacherDashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <RoleDashboard data={await getRoleDashboard('subject_teacher')} />
}
