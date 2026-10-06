import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Adds a row to Admin → Login History for the user `supabase` is now signed in
 * as (supabase/migration_login_history.sql — the database function reads the
 * name and role itself). Call it right after a successful sign-in.
 *
 * Best effort: never throws. A missing table (migration not run) or any other
 * failure is logged and the sign-in carries on.
 */
export async function recordLogin(supabase: SupabaseClient, method: 'microsoft' | 'password'): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_login', { p_method: method })
    if (error) console.error('[loginHistory] not recorded — is migration_login_history.sql applied?', error)
  } catch (err) {
    console.error('[loginHistory] not recorded', err)
  }
}
