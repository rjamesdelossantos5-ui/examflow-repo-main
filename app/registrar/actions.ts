'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'

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

  if (error) return { error: friendlyError('verifyRequest', error, `We couldn't verify this request. ${RETRY_HINT}`) }
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

// Verify every still-pending form for a student in one go. Only rows still at
// 'submitted' are touched (the .eq guard), so forms that already moved on are
// left alone. Returns how many were actually verified.
export async function verifyAll(requestIds: string[]) {
  const ctx = await requireRegistrar()
  if (!ctx) return { error: 'Unauthorized', count: 0 }
  const { supabase, userId, role } = ctx

  const ids = [...new Set(requestIds)].filter(Boolean)
  if (!ids.length) return { error: 'Nothing to verify.', count: 0 }

  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'verified_by_registrar' })
    .in('id', ids)
    .eq('status', 'submitted')
    .select('id')

  if (error) return { error: friendlyError('verifyAll', error, `We couldn't verify these requests. ${RETRY_HINT}`), count: 0 }
  const verified = updated ?? []
  if (!verified.length) return { error: 'These requests were already handled.', count: 0 }

  await supabase.from('progress_logs').insert(
    verified.map((u) => ({
      request_id: u.id,
      actor_id: userId,
      actor_role: role,
      action: 'Verified by Registrar — forwarded to Subject Teacher',
    }))
  )

  revalidatePath('/registrar')
  return { error: null, count: verified.length }
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

  if (error) return { error: friendlyError('rejectRequest', error, `We couldn't save this rejection. ${RETRY_HINT}`) }
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

/**
 * Marks a student's paid special exams as assessed, unlocking receipt upload.
 *
 * This is the Registrar's SECOND touch of a paid request. The Program Head has
 * already accepted it; the Registrar now totals every accepted paid subject that
 * student has, passes the figure to the Cashier, and stamps them here. Until
 * that happens the student cannot upload a receipt — which is what stops them
 * paying for one subject when they owe for three.
 *
 * Deliberately takes a STUDENT, not a request. The Registrar assesses a person's
 * whole bill in one go; stamping subjects one at a time would let half a
 * student's exams be assessed and the other half not, which is exactly the
 * confusion this step exists to prevent.
 */
export async function markPaymentAssessed(studentId: string) {
  const ctx = await requireRegistrar()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  // Same optimistic-concurrency guard as verifyRequest: the .eq/.is filters mean
  // a second click (or another registrar acting first) matches 0 rows rather
  // than re-stamping and double-logging.
  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ payment_assessed_at: new Date().toISOString(), payment_assessed_by: userId })
    .eq('student_id', studentId)
    .eq('status', 'accepted')
    .eq('exam_type', 'paid')
    .is('payment_assessed_at', null)
    .select('id')

  if (error) {
    return { error: friendlyError('markPaymentAssessed', error, `We couldn't record this assessment. ${RETRY_HINT}`) }
  }
  if (!updated?.length) return { error: 'This student has already been assessed, or has nothing awaiting assessment.' }

  const ids = (updated as { id: string }[]).map((r) => r.id)
  const { error: logErr } = await supabase.from('progress_logs').insert(
    ids.map((id) => ({
      request_id: id,
      actor_id: userId,
      actor_role: role,
      action: `Payment assessed by Registrar — ${ids.length} subject${ids.length === 1 ? '' : 's'}`,
    })),
  )
  // The stamp is what gates the student; the log is only the audit trail. Losing
  // the log must not fail an assessment that already succeeded.
  if (logErr) console.error('[markPaymentAssessed] progress log failed', logErr)

  revalidatePath('/registrar/assessment')
  revalidatePath('/student')
  return { error: null, count: ids.length }
}
