import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import ResetPanel from './ResetPanel'

export const metadata = { title: 'EXAMFLOW — Reset test data' }

// The layout already gates /admin on the admin role; this re-checks anyway,
// because a page that can destroy every request should not depend on a parent
// layout staying correct.
export default async function AdminResetPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') redirect('/login')

  return <ResetPanel />
}
