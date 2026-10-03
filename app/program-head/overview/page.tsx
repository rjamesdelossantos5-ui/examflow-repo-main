import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import OverviewClient from './OverviewClient'
import { loadOverviewRows } from './loadOverview'

export const metadata = { title: 'EXAMFLOW — Overview' }

export default async function OverviewPage() {
  const supabase = await createClient()
  // Cached helpers — the layout already resolved both, so these reuse its
  // results instead of re-hitting the auth server / profiles table.
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const me = await getMyProfileMeta()
  const rows = await loadOverviewRows(supabase, me?.department_id ?? null)

  return <OverviewClient rows={rows} viewer={me?.role === 'admin' ? 'admin' : 'program_head'} />
}
