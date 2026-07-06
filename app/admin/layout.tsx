import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications, countPendingOverrides } from '@/lib/notifications'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/login')

  const [notifications, overrides] = await Promise.all([
    getNotifications(supabase, user.id, 'admin'),
    countPendingOverrides(supabase),
  ])
  const nav = [
    { label: 'Users', href: '/admin/users', icon: 'users' as const },
    { label: 'Subjects', href: '/admin/subjects', icon: 'book' as const },
    { label: 'Departments', href: '/admin/departments', icon: 'building' as const },
    { label: 'Override Requests', href: '/admin/overrides', icon: 'inbox' as const, badge: overrides },
  ]

  return (
    <DashboardLayout role="admin" userName={profile.full_name} email={profile.email} navItems={nav} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
