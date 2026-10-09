import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'
import ResetPanel from './ResetPanel'
import Link from 'next/link'
import { isSettingOn, TOGGLE_SETTINGS } from '@/lib/settings'

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

  // Switched off in Admin → Settings: say so instead of showing the buttons.
  // The actions refuse on their own too (requireResetAllowed in ./actions).
  if (!(await isSettingOn(supabase, TOGGLE_SETTINGS.testReset))) {
    return (
      <div className="ef-card rounded-xl shadow-sm p-6 max-w-xl">
        <h2 className="text-lg font-bold" style={{ color: 'var(--card-foreground)' }}>Reset Test Data is switched off</h2>
        <p className="text-sm ef-muted mt-2">
          It can delete every request, uploaded file and imported school data, so it stays off unless you are testing.
          Turn it on in{' '}
          <Link href="/admin/settings" className="underline underline-offset-2 font-semibold">Admin → Settings</Link>.
        </p>
      </div>
    )
  }

  return <ResetPanel />
}
