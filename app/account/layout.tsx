import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import { NAV_BY_ROLE } from '@/lib/nav'
import type { UserRole } from '@/lib/supabase/types'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role as UserRole

  return (
    <DashboardLayout role={role} userName={profile.full_name} email={profile.email} navItems={NAV_BY_ROLE[role] ?? []}>
      {children}
    </DashboardLayout>
  )
}
