import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'

const NAV = [
  { label: 'Pending Queue', href: '/teacher' },
  { label: 'Reviewed History', href: '/teacher/history' },
]

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['subject_teacher', 'admin'].includes(profile.role)) redirect('/login')

  return (
    <DashboardLayout role="subject_teacher" userName={profile.full_name} navItems={NAV}>
      {children}
    </DashboardLayout>
  )
}
