import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications, countByStatus } from '@/lib/notifications'

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

  const [notifications, firstCount, secondCount] = await Promise.all([
    getNotifications(supabase, user.id, 'program_head'),
    countByStatus(supabase, 'approved_by_teacher'),
    countByStatus(supabase, 'receipt_uploaded'),
  ])
  const nav = [
    { label: 'First Approval', href: '/program-head', icon: 'inbox' as const, badge: firstCount },
    { label: 'Second Approval', href: '/program-head/receipts', icon: 'receipt' as const, badge: secondCount },
    { label: 'Overview', href: '/program-head/overview', icon: 'chart' as const },
    { label: 'Accepted Students', href: '/program-head/students', icon: 'cap' as const },
    { label: 'Settings', href: '/program-head/settings', icon: 'settings' as const },
  ]

  return (
    <DashboardLayout role="program_head" userName={profile.full_name} email={profile.email} navItems={nav} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
