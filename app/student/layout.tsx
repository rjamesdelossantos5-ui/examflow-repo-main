import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications } from '@/lib/notifications'

// No top-tabs for students — the dashboard's "+ New Request" button and the
// clickable EXAMFLOW logo (home) cover navigation.
const NAV: { label: string; href: string }[] = []

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'student') redirect('/login')

  const notifications = await getNotifications(supabase, user.id, 'student')

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
