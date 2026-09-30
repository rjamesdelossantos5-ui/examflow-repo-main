import { createClient } from '@/lib/supabase/server'
import ScheduleImport from './ScheduleImport'

export const metadata = { title: 'EXAMFLOW Admin — Class Schedule' }

export default async function SchedulePage() {
  const supabase = await createClient()

  const [{ data: departments }, { data: teachers }, { data: aliases }, { data: programs }, { data: offerings }] = await Promise.all([
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name, email').eq('role', 'subject_teacher').eq('is_active', true).order('full_name'),
    supabase.from('instructor_aliases').select('alias, teacher_id'),
    supabase.from('program_departments').select('program, department_id'),
    supabase.from('class_offerings').select('section, teacher_id'),
  ])

  const current = offerings ?? []
  return (
    <ScheduleImport
      departments={departments ?? []}
      teachers={(teachers ?? []) as { id: string; full_name: string; email: string }[]}
      savedTeachers={Object.fromEntries((aliases ?? []).map((a) => [a.alias as string, a.teacher_id as string]))}
      savedPrograms={Object.fromEntries((programs ?? []).map((p) => [p.program as string, p.department_id as string]))}
      current={{
        classes: current.length,
        sections: new Set(current.map((o) => o.section)).size,
        withoutTeacher: current.filter((o) => !o.teacher_id).length,
      }}
      // The migration adds these tables; until it runs, the page says so
      // instead of failing on an unknown table.
      migrationMissing={aliases === null || programs === null}
    />
  )
}
