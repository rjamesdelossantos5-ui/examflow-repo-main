'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Admin decisions on Program-Head override requests (a PH asking to
// fast-track a request stuck earlier in the pipeline).

// Every action re-checks the caller is an admin server-side — the UI hiding
// a button is not a security boundary.
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return null
  return { supabase, userId: user.id }
}

// Shared approve/deny path. The .eq('status', 'pending') guard means a
// request that was already decided (double-click, second admin) updates 0
// rows and reports "already handled" instead of silently re-deciding.
async function decide(id: string, status: 'approved' | 'denied') {
  const ctx = await requireAdmin()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId } = ctx

  const { data, error } = await supabase
    .from('override_requests')
    .update({ status, decided_by: userId, decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'This request was already handled.' }

  revalidatePath('/admin/overrides')
  revalidatePath('/program-head/overview')
  return { error: null }
}

export async function approveOverride(id: string) {
  return decide(id, 'approved')
}

export async function denyOverride(id: string) {
  return decide(id, 'denied')
}
