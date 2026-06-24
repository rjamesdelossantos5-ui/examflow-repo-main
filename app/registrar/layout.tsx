import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications } from '@/lib/notifications'

const NAV = [
  { label: 'Pending Queue', href: '/registrar', icon: 'inbox' },
  { label: 'Verified History', href: '/registrar/history', icon: 'history' },
] as const

export default async function RegistrarLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || !['registrar', 'admin'].includes(profile.role)) redirect('/login')

  const notifications = await getNotifications(supabase, user.id, 'registrar')

  return (
    <DashboardLayout role="registrar" userName={profile.full_name} email={profile.email} navItems={NAV} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
