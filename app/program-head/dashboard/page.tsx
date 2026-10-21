import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { getRoleDashboard } from '@/lib/roleDashboard'
import RoleDashboard from '@/components/RoleDashboard'

export const metadata = { title: 'EXAMFLOW — Program Head Dashboard' }

// Narrowed to the Program Head's own department inside getRoleDashboard.
export default async function ProgramHeadDashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <RoleDashboard data={await getRoleDashboard('program_head')} />
}
