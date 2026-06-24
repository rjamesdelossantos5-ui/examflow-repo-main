'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireRegistrar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!p || !['registrar', 'admin'].includes(p.role)) return null
  return { supabase, userId: user.id, role: p.role }
}

export async function verifyRequest(requestId: string) {
  const ctx = await requireRegistrar()
  if (!ctx) return { error: 'Unauthorized' }

  const { supabase, userId, role } = ctx

  // The .eq('status', 'submitted') is an optimistic-concurrency guard: if the
  // request already moved on (double-click, or another reviewer acted first),
  // 0 rows match. .select() lets us detect that and avoid logging a phantom
  // "Verified" entry / showing a false success to the reviewer.
  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'verified_by_registrar' })
    .eq('id', requestId)
    .eq('status', 'submitted')
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'This request was already handled by someone else.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: 'Verified by Registrar — forwarded to Subject Teacher',
  })

  revalidatePath('/registrar')
  return { error: null }
}

export async function rejectRequest(requestId: string, reason: string) {
  const ctx = await requireRegistrar()
  if (!ctx) return { error: 'Unauthorized' }

  const { supabase, userId, role } = ctx
  const sanitizedReason = String(reason).trim().slice(0, 1000)
  if (!sanitizedReason) return { error: 'Rejection reason is required' }

  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'rejected', rejection_reason: sanitizedReason, rejected_by_role: role })
    .eq('id', requestId)
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'Request not found or no longer editable.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: `Rejected by Registrar: ${sanitizedReason}`,
  })

  revalidatePath('/registrar')
  return { error: null }
}
