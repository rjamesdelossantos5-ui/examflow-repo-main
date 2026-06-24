import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'

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

  return (
    <DashboardLayout role="student" userName={profile.full_name} email={profile.email} navItems={NAV}>
      {children}
    </DashboardLayout>
  )
}
