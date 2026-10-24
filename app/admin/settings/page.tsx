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
  const [fee, testReset] = await Promise.all([
    getSpecialExamFee(supabase),
    isSettingOn(supabase, TOGGLE_SETTINGS.testReset),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Settings</h2>
        <p className="text-sm ef-muted">School-wide settings for EXAMFLOW.</p>
      </div>
      {/* Two groups side by side on wide screens: money on the left, the
          safety switches on the right. Stacked on phones. */}
      {/* Columns stretch to the same height, and the fee card fills its
          column, so its bottom edge lines up with the last Safety card. */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Fees</h3>
          <div className="flex-1 [&>form]:h-full">
            <FeeForm fee={fee} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Safety</h3>
          <div className="space-y-4">
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
          </div>
        </section>
      </div>
    </div>
  )
}
