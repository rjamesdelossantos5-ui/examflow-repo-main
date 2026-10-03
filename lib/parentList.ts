import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import { checkParentName, type ParentCheck, type ParentOnFile } from '@/lib/didit'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/** Student numbers are compared as digits only: "02000-331286" = "02000331286". */
export const normalizeStudentNumber = (v: unknown) => String(v ?? '').replace(/\D/g, '')

const ORDER: Record<string, number> = { father: 0, mother: 1 }

export interface ParentCheckInput {
  /** The request id the result is keyed by. */
  id: string
  /** The name Didit read off the parent's ID. */
  idName: string | null
  /** Prefer the number on the student's profile (from the school's records)
   *  over the one typed on the form, which the student can change. */
  studentNumber: string | null
  /** The student's account name and the name on the request. */
  studentNames: Array<string | null | undefined>
}

/**
 * The parent-name check (checkParentName in lib/didit.ts) for each request,
 * against the Registrar's parent list (supabase/migration_parent_list.sql).
 * If the list can't be read — for example before that migration is run —
 * every request reads as "no parent on file" instead of failing the page.
 */
export async function parentChecks(supabase: SupabaseServer, items: ParentCheckInput[]): Promise<Record<string, ParentCheck>> {
  const numbers = [...new Set(items.map((i) => normalizeStudentNumber(i.studentNumber)).filter(Boolean))]
  const byNumber = new Map<string, ParentOnFile[]>()
  if (numbers.length) {
    const { data, error } = await supabase
      .from('student_parents')
      .select('student_number, parent_name, relationship')
      .in('student_number', numbers)
    if (error) console.error('[parentList] could not read the parent list', error)
    for (const r of data ?? []) {
      const list = byNumber.get(r.student_number as string) ?? []
      list.push({ name: r.parent_name as string, relationship: r.relationship as string })
      byNumber.set(r.student_number as string, list)
    }
    for (const list of byNumber.values()) {
      list.sort((a, b) => (ORDER[a.relationship.toLowerCase()] ?? 2) - (ORDER[b.relationship.toLowerCase()] ?? 2))
    }
  }
  return Object.fromEntries(
    items.map((i) => [i.id, checkParentName(i.idName, i.studentNames, byNumber.get(normalizeStudentNumber(i.studentNumber)) ?? [])]),
  )
}
