import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications, countWaitingForAnyone } from '@/lib/notifications'
import { isSettingOn, TOGGLE_SETTINGS } from '@/lib/settings'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // One parallel wave — nothing below depends on the profile row, so it must
  // not wait behind it (the header can't paint until this layout resolves).
  const [profile, notifications, waiting, resetOn] = await Promise.all([
    getMyProfileMeta(),
    getNotifications(supabase, user.id, 'admin'),
    countWaitingForAnyone(supabase),
    isSettingOn(supabase, TOGGLE_SETTINGS.testReset),
  ])

  if (!profile || profile.role !== 'admin') redirect('/login')
  const nav = [
    { label: 'Analytics', href: '/admin/analytics', icon: 'chart' as const },
    { label: 'Users', href: '/admin/users', icon: 'users' as const },
    { label: 'Subjects', href: '/admin/subjects', icon: 'book' as const },
    // One workbook (departments, programs, staff, students, classes) that sets
    // up everyone's accounts and routes each request to its teacher.
    { label: 'School Data', href: '/admin/school-data', icon: 'upload' as const },
    // Departments is deliberately not listed. It's set up once and then never
    // touched, so it only added noise to a nav used every day. The page still
    // works at /admin/departments — reachable by URL when a department has to
    // be added, which the subject and user Excel imports both require (they
    // match departments by name and reject unknown ones). Department data also
    // still drives what a Program Head sees, via lib/deptFilter.ts.
    // Every form at every step; each opens on the Registrar, Teacher or Program
    // Head page where that step is done, which the admin may act on directly.
    { label: 'Requests', href: '/admin/requests', icon: 'inbox' as const, badge: waiting },
    // The same Exam Periods form as the Program Head's: term, submission
    // window and exam date.
    { label: 'Exam Periods', href: '/admin/exam-periods', icon: 'calendar' as const },
    // School-wide settings, starting with the special-exam fee.
    { label: 'Settings', href: '/admin/settings', icon: 'settings' as const },
    // Testing tool, not a school workflow: wipes every request so a demo run
    // can start clean. Kept on Admin, away from the daily queues, and only
    // listed while switched on in Settings (lib/settings.ts).
    ...(resetOn ? [{ label: 'Reset Test Data', href: '/admin/reset', icon: 'x' as const }] : []),
  ]

  return (
    <DashboardLayout role="admin" userName={profile.full_name} email={profile.email} navItems={nav} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
