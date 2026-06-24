import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'

const NAV = [
  { label: 'Users', href: '/admin/users' },
  { label: 'Subjects', href: '/admin/subjects' },
  { label: 'Departments', href: '/admin/departments' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/login')

  return (
    <DashboardLayout role="admin" userName={profile.full_name} email={profile.email} navItems={NAV}>
      {children}
    </DashboardLayout>
  )
}
