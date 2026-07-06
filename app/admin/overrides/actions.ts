'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return null
  return { supabase, userId: user.id }
}

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
