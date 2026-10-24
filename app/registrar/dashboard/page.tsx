import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { getRoleDashboard } from '@/lib/roleDashboard'
import RoleDashboard from '@/components/RoleDashboard'

export const metadata = { title: 'EXAMFLOW — Registrar Dashboard' }

export default async function RegistrarDashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <RoleDashboard data={await getRoleDashboard('registrar')} />
}
