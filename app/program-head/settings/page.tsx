import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsForm from './SettingsForm'

export const metadata = { title: 'EXAMFLOW — Settings' }

export default async function PHSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'submission_window_days')
    .single()

  const currentDays = Number(setting?.value ?? 7)

  return <SettingsForm currentDays={currentDays} />
}
