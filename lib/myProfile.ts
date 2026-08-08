import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/currentUser'

// Current user's role + department (deduped per request). `can_override` rides
// along so the Program Head Overview can reuse this single cached row instead
// of issuing its own second profiles query on every load.
export const getMyProfileMeta = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('role, department_id, full_name, email, can_override')
    .eq('id', user.id)
    .single()
  return (data as { role: string; department_id: string | null; full_name: string; email: string; can_override: boolean | null } | null) ?? null
})

// Subject ids the current Program Head is responsible for (their department).
// Returns null when there is no department (e.g. an admin) → "all subjects", so
// callers treat null as "no department filter".
export const getMyDeptSubjectIds = cache(async (): Promise<string[] | null> => {
  const meta = await getMyProfileMeta()
  if (!meta?.department_id) return null
  const supabase = await createClient()
  const { data } = await supabase.from('subjects').select('id').eq('department_id', meta.department_id)
  return (data ?? []).map((s) => s.id as string)
})
