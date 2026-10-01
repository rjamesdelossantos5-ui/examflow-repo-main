import { createClient } from '@/lib/supabase/server'
import SchoolDataImport from './SchoolDataImport'

export const metadata = { title: 'EXAMFLOW Admin — School Data' }

export default async function SchoolDataPage() {
  const supabase = await createClient()
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0)

  const [departments, programs, staff, students, classes, subjects, migration] = await Promise.all([
    count(supabase.from('departments').select('*', { count: 'exact', head: true })),
    count(supabase.from('program_departments').select('*', { count: 'exact', head: true })),
    count(supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['subject_teacher', 'registrar', 'program_head'])),
    count(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student')),
    count(supabase.from('class_offerings').select('*', { count: 'exact', head: true })),
    count(supabase.from('subjects').select('*', { count: 'exact', head: true })),
    // The import needs program_departments.name and class_offerings.import_batch.
    supabase.from('program_departments').select('name').limit(1),
  ])

  return (
    <SchoolDataImport
      current={{ departments, programs, staff, students, classes, subjects }}
      migrationMissing={!!migration.error}
    />
  )
}
