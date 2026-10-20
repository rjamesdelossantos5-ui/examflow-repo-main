'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'
import { emailRequestEvent } from '@/lib/requestEmails'
import { getSpecialExamFee, formatPeso } from '@/lib/fees'

async function requireRegistrar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!p || !['registrar', 'admin'].includes(p.role)) return null
  return { supabase, userId: user.id, role: p.role }
}

/**
 * Marks a student's paid special exams as assessed, unlocking receipt upload.
 *
 * This is the Registrar's ONLY touch of a request, and only for paid exams. The
 * Program Head has already accepted it; the Registrar now totals every accepted paid subject that
 * student has not been assessed for yet, passes the figure to the Cashier, and
 * stamps them here with one timestamp — that is one bill. A subject the Program
 * Head accepts later becomes a bill of its own. Until a subject is stamped the
 * student cannot upload a receipt for it — which is what stops them paying for
 * one subject when they owe for three.
 *
 * Deliberately takes a STUDENT, not a request. The Registrar assesses a person's
 * whole bill in one go; stamping subjects one at a time would let half a
 * student's exams be assessed and the other half not, which is exactly the
 * confusion this step exists to prevent.
 */
export async function markPaymentAssessed(studentId: string, shownFee: number) {
  const ctx = await requireRegistrar()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  // The fee is read here, not trusted from the browser. If the admin changed it
  // after this page was opened, the total the Registrar is looking at (and would
  // pass to the Cashier) is no longer what would be saved — stop and say so.
  const fee = await getSpecialExamFee(supabase)
  if (fee !== shownFee) {
    return { error: `The fee was changed to ${formatPeso(fee)} per subject. Reload the page to see the new total.` }
  }

  // Optimistic-concurrency guard: the .eq/.is filters mean
  // a second click (or another registrar acting first) matches 0 rows rather
  // than re-stamping and double-logging. assessed_fee locks in this fee for
  // these requests (supabase/migration_fee_setting.sql).
  const stamp = { payment_assessed_at: new Date().toISOString(), payment_assessed_by: userId }
  const assess = (values: Record<string, unknown>) => supabase
    .from('special_exam_requests')
    .update(values)
    .eq('student_id', studentId)
    .eq('status', 'accepted')
    .eq('exam_type', 'paid')
    .is('payment_assessed_at', null)
    .select('id')
  let { data: updated, error } = await assess({ ...stamp, assessed_fee: fee })
  if (error) {
    // migration_fee_setting.sql not run yet (no assessed_fee column) — still
    // record the assessment; the student's page then shows the current fee.
    console.error('[markPaymentAssessed] assessed_fee unavailable — is migration_fee_setting.sql applied?', error)
    ;({ data: updated, error } = await assess(stamp))
  }

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

  // One email per student (not per subject), carrying the whole total. Sent
  // after the response — see lib/requestEmails.ts.
  const total = `${formatPeso(fee * ids.length)} for ${ids.length} subject${ids.length === 1 ? '' : 's'}`
  after(() => emailRequestEvent('fees_assessed', [ids[0]], { reason: total }))

  revalidatePath('/registrar/assessment')
  revalidatePath('/student')
  return { error: null, count: ids.length }
}
