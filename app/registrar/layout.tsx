import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'

const NAV = [
  { label: 'Pending Queue', href: '/registrar' },
  { label: 'Verified History', href: '/registrar/history' },
]

export default async function RegistrarLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || !['registrar', 'admin'].includes(profile.role)) redirect('/login')

  return (
    <DashboardLayout role="registrar" userName={profile.full_name} email={profile.email} navItems={NAV}>
      {children}
    </DashboardLayout>
  )
}
