import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications, countPendingOverrides } from '@/lib/notifications'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // One parallel wave — nothing below depends on the profile row, so it must
  // not wait behind it (the header can't paint until this layout resolves).
  const [profile, notifications, overrides] = await Promise.all([
    getMyProfileMeta(),
    getNotifications(supabase, user.id, 'admin'),
    countPendingOverrides(supabase),
  ])

  if (!profile || profile.role !== 'admin') redirect('/login')
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
