import { createClient } from '@/lib/supabase/server'
import ParentList, { type ListedStudent } from './ParentList'

export const metadata = { title: 'EXAMFLOW — Parent List' }

const PAGE = 1000

/**
 * The Registrar's list of each student's father, mother and/or guardian. The
 * name on a parent's ID is compared with it on the Registrar's queue and the
 * Program Head's first approval (lib/parentList.ts). Advice only.
 */
export default async function ParentListPage() {
  const supabase = await createClient()

  // Read in pages: a single read stops at 1,000 rows.
  type Row = { student_number: string; student_name: string | null; parent_name: string; relationship: string }
  const rows: Row[] = []
  let migrationMissing = false
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await supabase
      .from('student_parents')
      .select('student_number, student_name, parent_name, relationship')
      .order('student_number')
      .range(from, from + PAGE - 1)
    if (error) { migrationMissing = true; break }
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < PAGE) break
  }

  const byStudent = new Map<string, ListedStudent>()
  for (const r of rows) {
    const s = byStudent.get(r.student_number) ?? { studentNumber: r.student_number, studentName: r.student_name ?? '', people: [] }
    s.people.push({ name: r.parent_name, relationship: r.relationship })
    byStudent.set(r.student_number, s)
  }
  const order: Record<string, number> = { father: 0, mother: 1 }
  const students = [...byStudent.values()]
  for (const s of students) s.people.sort((a, b) => (order[a.relationship.toLowerCase()] ?? 2) - (order[b.relationship.toLowerCase()] ?? 2))

  return <ParentList students={students} migrationMissing={migrationMissing} />
}
