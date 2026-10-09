import { createClient } from '@/lib/supabase/server'
import { getSpecialExamFee } from '@/lib/fees'
import { isSettingOn, TOGGLE_SETTINGS } from '@/lib/settings'
import FeeForm from './FeeForm'
import ToggleSetting from './ToggleSetting'

export const metadata = { title: 'EXAMFLOW Admin — Settings' }

// School-wide settings the admin changes without a code change: the
// special-exam fee (lib/fees.ts) and the safety switches (lib/settings.ts).
export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const [fee, testReset, adminRemoval] = await Promise.all([
    getSpecialExamFee(supabase),
    isSettingOn(supabase, TOGGLE_SETTINGS.testReset),
    isSettingOn(supabase, TOGGLE_SETTINGS.adminAccountRemoval),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Settings</h2>
        <p className="text-sm ef-muted">School-wide settings for EXAMFLOW.</p>
      </div>
      <FeeForm fee={fee} />

      <h3 className="text-sm font-semibold uppercase tracking-wide ef-muted pt-2">Safety</h3>
      <ToggleSetting
        settingKey={TOGGLE_SETTINGS.testReset}
        title="Reset Test Data"
        initialOn={testReset}
        description={
          <>
            Shows the <strong>Reset Test Data</strong> tab, which can delete every request, uploaded file and imported
            school data. Turn it on only while testing, and keep it off once the school is using EXAMFLOW.
          </>
        }
      />
      <ToggleSetting
        settingKey={TOGGLE_SETTINGS.adminAccountRemoval}
        title="Allow removing admin accounts"
        initialOn={adminRemoval}
        description={
          <>
            Lets an admin deactivate, delete or change the role of <strong>another</strong> admin account. Nobody can
            do this to their own account, whatever this is set to.
          </>
        }
      />
    </div>
  )
}
