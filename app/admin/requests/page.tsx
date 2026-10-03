import { createClient } from '@/lib/supabase/server'
import OverviewClient from '@/app/program-head/overview/OverviewClient'
import { loadOverviewRows } from '@/app/program-head/overview/loadOverview'

export const metadata = { title: 'EXAMFLOW Admin — Requests' }

// Every form in every department and the step it waits on. Each one opens on
// the Registrar, Teacher or Program Head page where that step is done; the
// admin is allowed on all of them (proxy.ts, and each role's layout and server
// actions accept 'admin'), and what the admin does is logged as Admin.
export default async function AdminRequestsPage() {
  const supabase = await createClient()
  // null department = every department (lib/deptFilter.ts).
  const rows = await loadOverviewRows(supabase, null)
  return <OverviewClient rows={rows} viewer="admin" />
}
