import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications, countByStatus } from '@/lib/notifications'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || !['subject_teacher', 'admin'].includes(profile.role)) redirect('/login')

  const [notifications, pending] = await Promise.all([
    getNotifications(supabase, user.id, 'subject_teacher'),
    countByStatus(supabase, 'verified_by_registrar'),
  ])
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
