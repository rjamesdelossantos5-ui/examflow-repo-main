import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta, getMyDeptSubjectIds } from '@/lib/myProfile'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications, countByStatus } from '@/lib/notifications'

export default async function ProgramHeadLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // The header (user name) is this page's LCP element, and it can't paint until
  // the layout finishes — so every SEQUENTIAL query here is directly visible as
  // load time. Everything below only needs user.id, so it all starts at once;
  // cache() in myProfile/activePeriod dedupes the shared profile/period lookups
  // across these branches (and with the page render that follows).
  const [profile, notifications, firstCount, secondCount] = await Promise.all([
    getMyProfileMeta(),
    getNotifications(supabase, user.id, 'program_head'),
    getMyDeptSubjectIds().then((ids) => countByStatus(supabase, 'approved_by_teacher', ids)),
    getMyDeptSubjectIds().then((ids) => countByStatus(supabase, 'receipt_uploaded', ids)),
  ])

  if (!profile || !['program_head', 'admin'].includes(profile.role)) redirect('/login')
  const nav = [
    { label: 'First Approval', href: '/program-head', icon: 'inbox' as const, badge: firstCount },
    { label: 'Second Approval', href: '/program-head/receipts', icon: 'receipt' as const, badge: secondCount },
    { label: 'Overview', href: '/program-head/overview', icon: 'chart' as const },
    { label: 'Accepted Students', href: '/program-head/students', icon: 'cap' as const },
    { label: 'Exam Periods', href: '/program-head/settings', icon: 'calendar' as const },
  ]

  return (
    <DashboardLayout role="program_head" userName={profile.full_name} email={profile.email} navItems={nav} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
