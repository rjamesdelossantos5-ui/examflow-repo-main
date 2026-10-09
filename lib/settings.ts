import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * On/off switches the admin sets in Admin → Settings, kept in the `settings`
 * table as 'true' / 'false' (only admins can write there — see
 * supabase/migration_fee_setting.sql). A switch with no row, or that can't be
 * read, counts as OFF: both guard something destructive, so "unknown" must
 * fail closed.
 */
export const TOGGLE_SETTINGS = {
  /** Shows Admin → Reset Test Data and lets its actions run. */
  testReset: 'test_reset_enabled',
  /** Lets an admin deactivate, delete or change the role of ANOTHER admin
   *  account. An admin can never do that to their own account. */
  adminAccountRemoval: 'admin_account_removal_enabled',
} as const

export type ToggleSettingKey = (typeof TOGGLE_SETTINGS)[keyof typeof TOGGLE_SETTINGS]

export function isToggleSettingKey(key: string): key is ToggleSettingKey {
  return (Object.values(TOGGLE_SETTINGS) as string[]).includes(key)
}

export async function isSettingOn(supabase: SupabaseClient, key: ToggleSettingKey): Promise<boolean> {
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle()
  return !error && data?.value === 'true'
}
