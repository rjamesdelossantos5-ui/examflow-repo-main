import { createClient } from '@/lib/supabase/server'
import SubjectList, { type SubjectRow, type TeacherOption } from './SubjectList'

export const metadata = { title: 'EXAMFLOW Admin — Subjects' }

export default async function SubjectsPage() {
  const supabase = await createClient()

  const [{ data: subjects }, { data: offerings }, { data: teachers }] = await Promise.all([
    supabase.from('subjects').select('id, subject_code, subject_name, departments(name)').order('subject_code'),
    supabase.from('class_offerings').select('id, subject_id, section, teacher_id'),
    supabase.from('profiles').select('id, full_name, departments(name)').eq('role', 'subject_teacher').order('full_name'),
  ])

  const classesBySubject = new Map<string, SubjectRow['classes']>()
  for (const o of offerings ?? []) {
    const list = classesBySubject.get(o.subject_id as string) ?? []
    list.push({ id: o.id as string, section: o.section as string, teacherId: (o.teacher_id as string | null) ?? null })
    classesBySubject.set(o.subject_id as string, list)
  }

  const rows: SubjectRow[] = (subjects ?? []).map((s) => ({
    id: s.id as string,
    code: s.subject_code as string,
    name: s.subject_name as string,
    department: (s.departments as unknown as { name: string } | null)?.name ?? null,
    classes: (classesBySubject.get(s.id as string) ?? []).sort((a, b) => a.section.localeCompare(b.section)),
  }))

  const teacherOptions: TeacherOption[] = (teachers ?? []).map((t) => ({
    id: t.id as string,
    name: t.full_name as string,
    department: (t.departments as unknown as { name: string } | null)?.name ?? null,
  }))

  return <SubjectList subjects={rows} teachers={teacherOptions} />
}
