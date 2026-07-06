import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'
import { ROLE_HOME } from '@/lib/nav'
import type { Profile, UserRole } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — My Account' }

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="max-w-2xl">
      <Link
        href={ROLE_HOME[profile.role as UserRole] ?? '/'}
        className="inline-flex items-center gap-1 text-sm ef-muted hover:underline mb-4"
      >
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>My Account</h1>
      <p className="text-sm ef-muted mb-6">Manage your personal information and password.</p>
      <ProfileForm profile={profile as unknown as Profile} />
    </div>
  )
}
