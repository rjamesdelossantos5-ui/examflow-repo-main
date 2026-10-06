import { createClient } from '@/lib/supabase/server'
import { getSpecialExamFee } from '@/lib/fees'
import FeeForm from './FeeForm'

export const metadata = { title: 'EXAMFLOW Admin — Settings' }

// School-wide settings the admin changes without a code change. For now, the
// special-exam fee (lib/fees.ts, supabase/migration_fee_setting.sql).
export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const fee = await getSpecialExamFee(supabase)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Settings</h2>
        <p className="text-sm ef-muted">School-wide settings for EXAMFLOW.</p>
      </div>
      <FeeForm fee={fee} />
    </div>
  )
}
