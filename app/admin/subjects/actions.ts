'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function sanitize(v: unknown) {
  return String(v ?? '').trim().slice(0, 500)
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return null
  return supabase
}

export interface ParsedRow {
  subject_code: string
  subject_name: string
  department_name: string
  teacher_email: string
  // resolved after validation:
  department_id?: string | null
  teacher_id?: string | null
  error?: string
}

// Pre-import check for the Excel preview: resolves department names and
// teacher emails to their DB ids in one pass (two lookups total, not two per
// row) and marks anything unknown with a row-level error so the admin can fix
// the file BEFORE anything is written.
export async function validateRows(rows: ParsedRow[]): Promise<ParsedRow[]> {
  const supabase = await requireAdmin()
  if (!supabase) return rows.map((r) => ({ ...r, error: 'Unauthorized' }))

  const [{ data: depts }, { data: teachers }] = await Promise.all([
    supabase.from('departments').select('id, name'),
    supabase.from('profiles').select('id, email').eq('role', 'subject_teacher'),
  ])

  const deptMap = new Map((depts ?? []).map((d) => [d.name.toLowerCase(), d.id]))
  const teacherMap = new Map((teachers ?? []).map((t) => [t.email.toLowerCase(), t.id]))

  return rows.map((row) => {
    const errors: string[] = []
    if (!row.subject_code) errors.push('missing subject_code')
    if (!row.subject_name) errors.push('missing subject_name')

    const dept_id = deptMap.get(row.department_name?.toLowerCase()) ?? null
    if (row.department_name && !dept_id) errors.push(`unknown department "${row.department_name}"`)

    const teacher_id = teacherMap.get(row.teacher_email?.toLowerCase()) ?? null
    if (row.teacher_email && !teacher_id) errors.push(`unknown teacher email "${row.teacher_email}"`)

    return {
      ...row,
      department_id: dept_id,
      teacher_id,
      error: errors.length ? errors.join('; ') : undefined,
    }
  })
}

// Writes the validated rows. subject_code is the natural key: an existing
// code updates that subject in place (keeping its id, so existing exam
// requests stay linked), a new code inserts. 'replace' clears the whole
// subject list first — the start-of-semester reset.
export async function importSubjects(rows: ParsedRow[], mode: 'replace' | 'upsert') {
  const supabase = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized', added: 0, updated: 0, skipped: 0 }

  const valid = rows.filter((r) => !r.error)
  if (valid.length === 0) return { error: 'No valid rows to import', added: 0, updated: 0, skipped: rows.length }

  if (mode === 'replace') {
    await supabase.from('subjects').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  let added = 0
  let updated = 0
  const skipped = rows.length - valid.length

  for (const row of valid) {
    const { data: existing } = await supabase
      .from('subjects')
      .select('id')
      .eq('subject_code', row.subject_code)
      .maybeSingle()

    if (existing) {
      await supabase.from('subjects').update({
        subject_name: sanitize(row.subject_name),
        department_id: row.department_id ?? null,
        teacher_id: row.teacher_id ?? null,
      }).eq('id', existing.id)
      updated++
    } else {
      await supabase.from('subjects').insert({
        subject_code: sanitize(row.subject_code),
        subject_name: sanitize(row.subject_name),
        department_id: row.department_id ?? null,
        teacher_id: row.teacher_id ?? null,
      })
      added++
    }
  }

  revalidatePath('/admin/subjects')
  return { error: null, added, updated, skipped }
}
