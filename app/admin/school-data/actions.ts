'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, SERVICE_KEY_MISSING } from '@/lib/supabase/admin'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'
import { PEOPLE_CHUNK_SIZE, type ClassRow, type Program, type StaffRole } from '@/lib/schoolData'

/**
 * Writes the school data workbook (lib/schoolData.ts) in three steps the
 * browser calls in order — structure, then people in small chunks (creating a
 * login is one API call each, so a big list can't fit in one request), then
 * classes, which need the teacher accounts to exist.
 */

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return null
  return supabase
}

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

// ── 1. Departments and programs ─────────────────────────────────────────────

export async function importStructure(input: { departments: string[]; programs: Program[] }) {
  const supabase = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const names = [...new Set((input.departments ?? []).map((d) => clip(d, 120)).filter(Boolean))]
  if (names.length) {
    const { error } = await supabase.from('departments').upsert(names.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
    if (error) return { error: friendlyError('importStructure.departments', error, `We couldn't save the departments. ${RETRY_HINT}`) }
  }
  const { data: depts } = await supabase.from('departments').select('id, name')
  const deptId = new Map((depts ?? []).map((d) => [String(d.name).toLowerCase(), d.id as string]))

  const programRows = (input.programs ?? []).map((p) => ({
    program: clip(p.code, 20).toUpperCase(),
    name: clip(p.name, 200) || null,
    department_id: deptId.get(clip(p.department, 120).toLowerCase()),
  }))
  if (programRows.some((p) => !p.program || !p.department_id)) return { error: 'A program points at a department that could not be saved.' }
  if (programRows.length) {
    const { error } = await supabase.from('program_departments').upsert(programRows)
    if (error) return { error: friendlyError('importStructure.programs', error, `We couldn't save the programs. ${RETRY_HINT}`) }
  }
  return { error: null }
}

// ── 2. People (staff and students) ──────────────────────────────────────────

export interface PersonInput {
  fullName: string
  email: string
  role: StaffRole | 'student'
  department?: string | null
  studentNumber?: string
  program?: string
  yearLevel?: number
  section?: string
}

/**
 * Creates each person's account, or updates it if the email already has one
 * (for example a teammate who already signed in with Microsoft — they keep
 * that sign-in and get their role and details from the file). New accounts are
 * created without a password: Supabase then sets a random one nobody knows
 * (adminUserCreate in supabase/auth), so made-up people can't be signed into,
 * and a real person signs in with Microsoft, which Supabase attaches to the
 * account with the same verified email. An admin account is never changed.
 */
export async function importPeopleChunk(people: PersonInput[]) {
  const supabase = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized', created: 0, updated: 0, failures: [] as { email: string; reason: string }[] }
  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_KEY_MISSING, created: 0, updated: 0, failures: [] }
  if ((people ?? []).length > PEOPLE_CHUNK_SIZE) return { error: 'Chunk too large', created: 0, updated: 0, failures: [] }

  const [{ data: depts }, { data: programs }] = await Promise.all([
    supabase.from('departments').select('id, name'),
    supabase.from('program_departments').select('program, department_id'),
  ])
  const deptId = new Map((depts ?? []).map((d) => [String(d.name).toLowerCase(), d.id as string]))
  const programDept = new Map((programs ?? []).map((p) => [String(p.program), p.department_id as string]))

  let created = 0
  let updated = 0
  const failures: { email: string; reason: string }[] = []

  for (const p of people) {
    const email = clip(p.email, 254).toLowerCase()
    const isStudent = p.role === 'student'
    const details = {
      full_name: clip(p.fullName, 200),
      email,
      role: p.role,
      department_id: isStudent ? programDept.get(clip(p.program, 20).toUpperCase()) ?? null : p.department ? deptId.get(clip(p.department, 120).toLowerCase()) ?? null : null,
      student_number: isStudent ? clip(p.studentNumber, 40) || null : null,
      course: isStudent ? clip(p.program, 20).toUpperCase() || null : null,
      year_level: isStudent && Number.isInteger(p.yearLevel) ? p.yearLevel! : null,
      section: isStudent ? clip(p.section, 60).toUpperCase() || null : null,
      is_active: true,
    }

    const { data: existing } = await supabase.from('profiles').select('id, role').eq('email', email).maybeSingle()
    if (existing?.role === 'admin') { failures.push({ email, reason: 'is an admin account — left unchanged' }); continue }

    if (existing) {
      const { error } = await supabase.from('profiles').update(details).eq('id', existing.id)
      if (error) failures.push({ email, reason: friendlyError('importPeopleChunk.update', error, 'could not update the account') })
      else updated++
      continue
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { full_name: details.full_name },
    })
    if (authError || !authData.user) { failures.push({ email, reason: authError?.message ?? 'account creation failed' }); continue }
    // handle_new_user() made a bare student profile; fill in the rest.
    const { error: profileError } = await supabase.from('profiles').upsert({ id: authData.user.id, ...details })
    if (profileError) failures.push({ email, reason: 'account created but its details failed to save' })
    else created++
  }

  revalidatePath('/admin/users')
  return { error: null, created, updated, failures }
}

// ── 3. Subjects and classes ─────────────────────────────────────────────────

/**
 * Replaces the class list. Subjects are saved once per code + department (the
 * subjects table allows that), so a shared subject still routes to the
 * student's own Program Head. New classes are saved first, tagged with a new
 * batch, and only then are older classes removed — a failure never leaves
 * students with an empty list. Submitted requests keep their teacher.
 */
export async function importClasses(input: { classes: ClassRow[]; subjectNames: Record<string, string> }) {
  const supabase = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const classes = (input.classes ?? []).slice(0, 10000)
  if (!classes.length) return { error: 'There are no classes to import.' }

  const teacherEmails = [...new Set(classes.map((c) => clip(c.teacherEmail, 254).toLowerCase()))]
  const [{ data: programs }, { data: teachers }] = await Promise.all([
    supabase.from('program_departments').select('program, department_id'),
    supabase.from('profiles').select('id, email').eq('role', 'subject_teacher').in('email', teacherEmails),
  ])
  const programDept = new Map((programs ?? []).map((p) => [String(p.program), p.department_id as string]))
  const teacherId = new Map((teachers ?? []).map((t) => [String(t.email).toLowerCase(), t.id as string]))

  const subjects = new Map<string, { subject_code: string; subject_name: string; department_id: string }>()
  for (const c of classes) {
    const department_id = programDept.get(c.program)
    if (!department_id) return { error: `Program ${c.program} has no department. Import again from the start.` }
    subjects.set(`${c.code}|${department_id}`, { subject_code: clip(c.code, 40), subject_name: clip(input.subjectNames?.[c.code] || c.subjectName || c.code, 300), department_id })
  }
  const subjectId = new Map<string, string>()
  const list = [...subjects.values()]
  for (let i = 0; i < list.length; i += 300) {
    const { data, error } = await supabase.from('subjects').upsert(list.slice(i, i + 300), { onConflict: 'subject_code,department_id' }).select('id, subject_code, department_id')
    if (error) return { error: friendlyError('importClasses.subjects', error, `We couldn't save the subjects. ${RETRY_HINT}`) }
    for (const s of data ?? []) subjectId.set(`${s.subject_code}|${s.department_id}`, s.id as string)
  }

  const batch = randomUUID()
  const rows = classes.map((c) => ({
    subject_id: subjectId.get(`${c.code}|${programDept.get(c.program)}`)!,
    section: clip(c.section, 60).toUpperCase(),
    year_level: c.yearLevel,
    teacher_id: teacherId.get(clip(c.teacherEmail, 254).toLowerCase()) ?? null,
    import_batch: batch,
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('class_offerings').upsert(rows.slice(i, i + 500), { onConflict: 'subject_id,section' })
    if (error) return { error: friendlyError('importClasses.offerings', error, `We couldn't save the classes. Nothing was removed — the previous classes are still in place. ${RETRY_HINT}`) }
  }
  const { error: delErr } = await supabase.from('class_offerings').delete().or(`import_batch.is.null,import_batch.neq.${batch}`)
  if (delErr) return { error: friendlyError('importClasses.cleanup', delErr, `The new classes were saved, but old ones could not be removed. ${RETRY_HINT}`) }

  revalidatePath('/admin/school-data')
  revalidatePath('/admin/subjects')
  revalidatePath('/student/submit')
  return { error: null, classes: rows.length, subjects: list.length, withoutTeacher: rows.filter((r) => !r.teacher_id).length }
}
