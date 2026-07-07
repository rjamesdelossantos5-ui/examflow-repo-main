import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications, countByStatus } from '@/lib/notifications'

export default async function RegistrarLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || !['registrar', 'admin'].includes(profile.role)) redirect('/login')

  const [notifications, pending] = await Promise.all([
    getNotifications(supabase, user.id, 'registrar'),
    countByStatus(supabase, 'submitted'),
  ])
  const nav = [
    { label: 'Pending Queue', href: '/registrar', icon: 'inbox' as const, badge: pending },
    { label: 'Verified History', href: '/registrar/history', icon: 'history' as const },
  ]

  return (
    <DashboardLayout role="registrar" userName={profile.full_name} email={profile.email} navItems={nav} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
