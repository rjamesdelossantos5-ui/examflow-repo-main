import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import DashboardLayout from '@/components/DashboardLayout'
import { NAV_BY_ROLE } from '@/lib/nav'
import { getNotifications } from '@/lib/notifications'
import type { UserRole } from '@/lib/supabase/types'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // Cached helpers so the layout and the page it wraps share one auth lookup
  // and one profiles read, instead of each issuing their own.
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getMyProfileMeta()
  if (!profile) redirect('/login')

  const role = profile.role as UserRole
  const notifications = await getNotifications(supabase, user.id, role)

  return (
    <DashboardLayout role={role} userName={profile.full_name} email={profile.email} navItems={NAV_BY_ROLE[role] ?? []} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
