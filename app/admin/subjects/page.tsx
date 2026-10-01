import { createClient } from '@/lib/supabase/server'
import SubjectList, { type SubjectRow } from './SubjectList'

export const metadata = { title: 'EXAMFLOW Admin — Subjects' }

export default async function SubjectsPage() {
  const supabase = await createClient()

  const [{ data: subjects }, { data: offerings }] = await Promise.all([
    supabase.from('subjects').select('id, subject_code, subject_name, departments(name)').order('subject_code'),
    supabase.from('class_offerings').select('subject_id'),
  ])

  const classCount = new Map<string, number>()
  for (const o of offerings ?? []) classCount.set(o.subject_id as string, (classCount.get(o.subject_id as string) ?? 0) + 1)

  const rows: SubjectRow[] = (subjects ?? []).map((s) => ({
    id: s.id as string,
    code: s.subject_code as string,
    name: s.subject_name as string,
    department: (s.departments as unknown as { name: string } | null)?.name ?? null,
    classes: classCount.get(s.id as string) ?? 0,
  }))

  return <SubjectList subjects={rows} />
}
