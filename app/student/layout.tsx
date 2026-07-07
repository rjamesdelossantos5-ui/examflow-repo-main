import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications } from '@/lib/notifications'

const NAV = [
  { label: 'My Requests', href: '/student', icon: 'inbox' as const },
  { label: 'History', href: '/student/history', icon: 'history' as const },
]

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // One parallel wave — nothing below depends on the profile row, so it must
  // not wait behind it (the header can't paint until this layout resolves).
  const [profile, notifications] = await Promise.all([
    getMyProfileMeta(),
    getNotifications(supabase, user.id, 'student'),
  ])

  if (!profile || profile.role !== 'student') redirect('/login')

  return (
    <DashboardLayout
      role="student"
      userId={user.id}
      userName={profile.full_name}
      email={profile.email}
      navItems={NAV}
      notifications={notifications}
    >
      {children}
    </DashboardLayout>
  )
}
