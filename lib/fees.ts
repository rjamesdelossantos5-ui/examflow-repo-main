import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Special-exam fees.
 *
 * The fee per subject is set by the admin (Admin → Settings) and kept in the
 * `settings` table under FEE_SETTING_KEY — see supabase/migration_fee_setting.sql.
 * When the Registrar assesses a student, the fee at that moment is saved on each
 * request (assessed_fee), so changing it later never changes what an assessed
 * student was told to pay.
 *
 * NOTE: this is a flat per-subject fee. If the school ever charges different
 * amounts per subject or per course, this is the wrong shape and the Registrar
 * should be entering the total by hand instead.
 */

/** Used when the setting can't be read (migration not run yet, or no row). */
export const DEFAULT_SPECIAL_EXAM_FEE = 200
export const FEE_SETTING_KEY = 'special_exam_fee'
/** Upper bound the admin can set, to catch a typo like an extra zero or two. */
export const MAX_SPECIAL_EXAM_FEE = 100000

/** The current fee per subject, in whole pesos. */
export async function getSpecialExamFee(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from('settings').select('value').eq('key', FEE_SETTING_KEY).maybeSingle()
  const fee = Number(data?.value)
  if (error || !data || !Number.isInteger(fee) || fee < 0) return DEFAULT_SPECIAL_EXAM_FEE
  return fee
}

/** ₱1,200 — grouped thousands, no decimals, since the fee is always whole pesos. */
export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH')}`
}

/** What a student owes for `count` accepted paid subjects at `fee` each. */
export function totalFee(count: number, fee: number): number {
  return count * fee
}
