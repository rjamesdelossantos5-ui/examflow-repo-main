import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import DashboardLayout from '@/components/DashboardLayout'
import { getNotifications, countRegistrarPending } from '@/lib/notifications'

export default async function RegistrarLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // One parallel wave — nothing below depends on the profile row, so it must
  // not wait behind it (the header can't paint until this layout resolves).
  const [profile, notifications, pending] = await Promise.all([
    getMyProfileMeta(),
    getNotifications(supabase, user.id, 'registrar'),
    // Same gate as the queue — see lib/registrarGate.ts.
    countRegistrarPending(supabase),
  ])

  if (!profile || !['registrar', 'admin'].includes(profile.role)) redirect('/login')
  const nav = [
    { label: 'Pending Queue', href: '/registrar', icon: 'inbox' as const, badge: pending },
    // The Registrar's SECOND touch of a paid request: after the Program Head
    // accepts, total the student's special-exam subjects and pass the amount to
    // the Cashier. See app/registrar/assessment/page.tsx.
    { label: 'Payment Assessment', href: '/registrar/assessment', icon: 'receipt' as const },
    { label: 'Verified History', href: '/registrar/history', icon: 'history' as const },
  ]

  return (
    <DashboardLayout role="registrar" userName={profile.full_name} email={profile.email} navItems={nav} notifications={notifications}>
      {children}
    </DashboardLayout>
  )
}
