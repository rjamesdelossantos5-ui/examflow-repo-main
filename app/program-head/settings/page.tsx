import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getExamSettings } from '@/lib/examSettings'
import SettingsForm from './SettingsForm'

export const metadata = { title: 'EXAMFLOW — Settings' }

export default async function PHSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const settings = await getExamSettings(supabase)

  return <SettingsForm settings={settings} />
}
