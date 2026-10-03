'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'
import { readParentList } from '@/lib/parentListFile'

async function requireRegistrar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!p || !['registrar', 'admin'].includes(p.role)) return null
  return supabase
}

/** Upper bound on rows across all sheets, far above a real campus. */
const MAX_ROWS = 50000
const CHUNK = 500

/**
 * Replaces the whole parent list with the uploaded file. The server reads the
 * file again with the same reader the browser used, so only a checked list is
 * saved. New rows go in first under a new batch and the old ones are removed
 * after, so a failure part-way never leaves the Registrar with an empty list.
 */
export async function replaceParentList(grids: Record<string, unknown[][]>) {
  const supabase = await requireRegistrar()
  if (!supabase) return { error: 'Unauthorized', students: 0, people: 0 }

  const rowsIn = Object.values(grids ?? {}).reduce((n, g) => n + (Array.isArray(g) ? g.length : 0), 0)
  if (rowsIn > MAX_ROWS) return { error: 'This file is too large.', students: 0, people: 0 }

  const list = readParentList(grids ?? {})
  if (list.errors.length) return { error: `The file still has ${list.errors.length} problem${list.errors.length === 1 ? '' : 's'} to fix.`, students: 0, people: 0 }

  const batch = randomUUID()
  const records = list.rows.flatMap((r) =>
    r.people.map((p) => ({ student_number: r.studentNumber, student_name: r.studentName || null, parent_name: p.name, relationship: p.relationship, import_batch: batch })),
  )

  for (let i = 0; i < records.length; i += CHUNK) {
    const { error } = await supabase.from('student_parents').upsert(records.slice(i, i + CHUNK), { onConflict: 'student_number,parent_name' })
    if (error) return { error: friendlyError('replaceParentList', error, `We couldn't save the parent list. ${RETRY_HINT}`), students: 0, people: 0 }
  }

  const { error: delErr } = await supabase.from('student_parents').delete().or(`import_batch.is.null,import_batch.neq.${batch}`)
  if (delErr) return { error: friendlyError('replaceParentList.cleanup', delErr, `The new list was saved, but the old one could not be removed. ${RETRY_HINT}`), students: 0, people: 0 }

  revalidatePath('/registrar/parents')
  revalidatePath('/registrar')
  revalidatePath('/program-head')
  return { error: null, students: list.rows.length, people: records.length }
}
