import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'

const NAV = [
  { label: 'Approval Queue', href: '/program-head' },
  { label: 'Accepted Students', href: '/program-head/students' },
  { label: 'Settings', href: '/program-head/settings' },
]

export default async function ProgramHeadLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['program_head', 'admin'].includes(profile.role)) redirect('/login')

  return (
    <DashboardLayout role="program_head" userName={profile.full_name} navItems={NAV}>
      {children}
    </DashboardLayout>
  )
}
