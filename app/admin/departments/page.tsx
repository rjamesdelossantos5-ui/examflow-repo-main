import { createClient } from '@/lib/supabase/server'
import DeptManager from './DeptManager'

export const metadata = { title: 'EXAMFLOW Admin — Departments' }

export default async function DepartmentsPage() {
  const supabase = await createClient()
  const { data: departments } = await supabase.from('departments').select('*').order('name')
  return <DeptManager departments={departments ?? []} />
}
