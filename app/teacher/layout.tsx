import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications, countByStatus } from '@/lib/notifications'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // One parallel wave — nothing below depends on the profile row, so it must
  // not wait behind it (the header can't paint until this layout resolves).
  // getMyProfileMeta also dedupes with the teacher page, which uses it too.
  const [profile, notifications, pending] = await Promise.all([
    getMyProfileMeta(),
    getNotifications(supabase, user.id, 'subject_teacher'),
    countByStatus(supabase, 'verified_by_registrar'),
  ])

  if (!profile || !['subject_teacher', 'admin'].includes(profile.role)) redirect('/login')
  const nav = [
    { label: 'Pending Queue', href: '/teacher', icon: 'inbox' as const, badge: pending },
    { label: 'Reviewed History', href: '/teacher/history', icon: 'history' as const },
  ]

  return (
    <DashboardLayout role="subject_teacher" userName={profile.full_name} email={profile.email} navItems={nav} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
