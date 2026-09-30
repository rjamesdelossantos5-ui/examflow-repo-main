'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return null
  return supabase
}

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

export interface ScheduleImportPayload {
  /** Program (section prefix, e.g. "BSIT") → department id. */
  programs: Record<string, string>
  /** Instructor as written in the file → teacher account id, or null = not assigned yet. */
  teachers: Record<string, string | null>
  /** Subject code → name. */
  subjectNames: Record<string, string>
  offerings: { section: string; program: string; yearLevel: number | null; code: string; instructor: string }[]
}

/**
 * Replaces the class schedule with the one the admin just reviewed.
 *
 * Order matters so a failure never leaves students with an empty list:
 *  1. remember the admin's program → department and instructor → teacher
 *     choices (reused next term);
 *  2. make sure every subject exists — once per department, which the
 *     subjects table already allows (unique code + department), so a shared
 *     subject such as Purposive Communication still reaches the student's own
 *     Program Head;
 *  3. add/update this term's offerings, tagged with a new batch id;
 *  4. only then remove offerings from earlier imports.
 * Existing requests are untouched: each keeps the teacher it was routed to.
 */
export async function importSchedule(p: ScheduleImportPayload) {
  const supabase = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const offerings = (p.offerings ?? []).slice(0, 5000).map((o) => ({
    section: clip(o.section, 60).toUpperCase(),
    program: clip(o.program, 20).toUpperCase(),
    yearLevel: Number.isInteger(o.yearLevel) && o.yearLevel! >= 1 && o.yearLevel! <= 6 ? o.yearLevel : null,
    code: clip(o.code, 40).toUpperCase(),
    instructor: clip(o.instructor, 120).toUpperCase(),
  })).filter((o) => o.section && o.code && o.program)
  if (!offerings.length) return { error: 'There are no classes to import.' }

  // Every id the browser sent must be real: departments, and teacher accounts.
  const deptIds = [...new Set(Object.values(p.programs ?? {}))].filter(Boolean)
  const teacherIds = [...new Set(Object.values(p.teachers ?? {}).filter((v): v is string => !!v))]
  const [{ data: depts }, { data: teachers }] = await Promise.all([
    supabase.from('departments').select('id').in('id', deptIds.length ? deptIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('profiles').select('id').eq('role', 'subject_teacher').in('id', teacherIds.length ? teacherIds : ['00000000-0000-0000-0000-000000000000']),
  ])
  const validDept = new Set((depts ?? []).map((d) => d.id as string))
  const validTeacher = new Set((teachers ?? []).map((t) => t.id as string))

  const programDept = new Map<string, string>()
  for (const prog of new Set(offerings.map((o) => o.program))) {
    const d = p.programs?.[prog]
    if (!d || !validDept.has(d)) return { error: `Choose a department for ${prog} first.` }
    programDept.set(prog, d)
  }
  const teacherOf = (alias: string) => {
    const t = alias ? p.teachers?.[alias] : null
    return t && validTeacher.has(t) ? t : null
  }

  // 1. Remember the admin's choices.
  const { error: progErr } = await supabase.from('program_departments').upsert(
    [...programDept].map(([program, department_id]) => ({ program, department_id })),
  )
  if (progErr) return { error: friendlyError('importSchedule.programs', progErr, `We couldn't save the program departments. ${RETRY_HINT}`) }
  const aliasRows = Object.keys(p.teachers ?? {})
    .map((alias) => ({ alias: clip(alias, 120).toUpperCase(), teacher_id: teacherOf(alias) }))
    .filter((a): a is { alias: string; teacher_id: string } => !!a.alias && !!a.teacher_id)
    .map((a) => ({ ...a, updated_at: new Date().toISOString() }))
  if (aliasRows.length) {
    const { error } = await supabase.from('instructor_aliases').upsert(aliasRows)
    if (error) return { error: friendlyError('importSchedule.aliases', error, `We couldn't save the teacher matches. ${RETRY_HINT}`) }
  }

  // 2. Subjects, once per code + department.
  const subjectKeys = new Map<string, { subject_code: string; subject_name: string; department_id: string }>()
  for (const o of offerings) {
    const department_id = programDept.get(o.program)!
    subjectKeys.set(`${o.code}|${department_id}`, {
      subject_code: o.code,
      subject_name: clip(p.subjectNames?.[o.code] || o.code, 300),
      department_id,
    })
  }
  const subjectIds = new Map<string, string>()
  const subjectList = [...subjectKeys.values()]
  for (let i = 0; i < subjectList.length; i += 300) {
    const { data, error } = await supabase
      .from('subjects')
      .upsert(subjectList.slice(i, i + 300), { onConflict: 'subject_code,department_id' })
      .select('id, subject_code, department_id')
    if (error) return { error: friendlyError('importSchedule.subjects', error, `We couldn't save the subjects. ${RETRY_HINT}`) }
    for (const s of data ?? []) subjectIds.set(`${s.subject_code}|${s.department_id}`, s.id as string)
  }

  // 3. This term's offerings, tagged with a new batch.
  const batch = randomUUID()
  const rows = offerings.map((o) => ({
    subject_id: subjectIds.get(`${o.code}|${programDept.get(o.program)}`)!,
    section: o.section,
    year_level: o.yearLevel,
    instructor: o.instructor || null,
    teacher_id: teacherOf(o.instructor),
    import_batch: batch,
  })).filter((r) => r.subject_id)
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('class_offerings').upsert(rows.slice(i, i + 500), { onConflict: 'subject_id,section' })
    if (error) return { error: friendlyError('importSchedule.offerings', error, `We couldn't save the classes. Nothing was removed — the previous schedule is still in place. ${RETRY_HINT}`) }
  }

  // 4. Only now drop earlier terms' offerings (including hand-made test ones).
  const { error: delErr } = await supabase.from('class_offerings').delete().or(`import_batch.is.null,import_batch.neq.${batch}`)
  if (delErr) return { error: friendlyError('importSchedule.cleanup', delErr, `The new schedule was saved, but old classes could not be removed. ${RETRY_HINT}`) }

  revalidatePath('/admin/schedule')
  revalidatePath('/student/submit')
  return {
    error: null,
    classes: rows.length,
    subjects: subjectList.length,
    unassigned: rows.filter((r) => !r.teacher_id).length,
  }
}
