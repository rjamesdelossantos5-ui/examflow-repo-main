import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications } from '@/lib/notifications'

const NAV = [
  { label: 'First Approval', href: '/program-head', icon: 'inbox' },
  { label: 'Second Approval', href: '/program-head/receipts', icon: 'receipt' },
  { label: 'Overview', href: '/program-head/overview', icon: 'chart' },
  { label: 'Accepted Students', href: '/program-head/students', icon: 'cap' },
  { label: 'Settings', href: '/program-head/settings', icon: 'settings' },
] as const

export default async function ProgramHeadLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || !['program_head', 'admin'].includes(profile.role)) redirect('/login')

  const notifications = await getNotifications(supabase, user.id, 'program_head')

  return (
    <DashboardLayout role="program_head" userName={profile.full_name} email={profile.email} navItems={NAV} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
