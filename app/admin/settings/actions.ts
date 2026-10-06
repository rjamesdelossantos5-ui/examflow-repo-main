'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'
import { FEE_SETTING_KEY, MAX_SPECIAL_EXAM_FEE, formatPeso } from '@/lib/fees'

/**
 * Sets the special-exam fee per subject (lib/fees.ts). Only students the
 * Registrar has not assessed yet are affected — an assessed student keeps the
 * fee saved on their requests (supabase/migration_fee_setting.sql). The
 * settings table only lets admins write, so the database enforces this too.
 */
export async function updateSpecialExamFee(input: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return { error: 'Unauthorized' }

  const raw = String(input ?? '').trim()
  const fee = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isInteger(fee)) return { error: 'Enter the fee in whole pesos, e.g. 200.' }
  if (fee > MAX_SPECIAL_EXAM_FEE) return { error: `The fee can't be more than ${formatPeso(MAX_SPECIAL_EXAM_FEE)}.` }

  const { error } = await supabase
    .from('settings')
    .upsert({ key: FEE_SETTING_KEY, value: String(fee), updated_at: new Date().toISOString() })
  if (error) {
    return { error: friendlyError('updateSpecialExamFee', error, `We couldn't save the fee. Has supabase/migration_fee_setting.sql been run? ${RETRY_HINT}`) }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/registrar/assessment')
  return { error: null, fee }
}
