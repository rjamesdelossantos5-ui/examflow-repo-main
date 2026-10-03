import type { SupabaseClient } from '@supabase/supabase-js'
import type { SchoolData } from '@/lib/schoolData'

/**
 * What the School Data file waiting for review would change, compared with
 * what is in the database now. Read-only; mirrors the rules the import itself
 * follows (app/admin/school-data/actions.ts): accounts matched by email, admins
 * never changed, classes matched by section + subject code and replaced as a
 * whole list, subjects kept once per code + department.
 */

export interface ReviewItem { label: string; detail: string }

export interface ImportReview {
  id: string
  fileName: string
  uploadedAt: string
  /** The checked workbook — what Accept imports. */
  data: SchoolData
  newDepartments: string[]
  newPrograms: string[]
  newAccounts: ReviewItem[]
  changedAccounts: ReviewItem[]
  unchangedAccounts: number
  skippedAdmins: string[]
  /** Accounts in the system but not in the file. The import leaves them as they are. */
  keptAccounts: ReviewItem[]
  addedClasses: string[]
  removedClasses: string[]
  teacherChanges: ReviewItem[]
  unchangedClasses: number
  newSubjects: string[]
  /** Subjects in the system but not in the file: they stay, with no classes. */
  leftoverSubjects: number
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  student: 'Student',
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()

/** The latest file waiting for review, compared with the live data. Null when none is waiting. */
export async function buildImportReview(supabase: SupabaseClient): Promise<ImportReview | null> {
  const { data: staged, error } = await supabase
    .from('school_data_imports')
    .select('id, file_name, data, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !staged) return null
  const data = staged.data as SchoolData
  return {
    id: staged.id as string,
    fileName: staged.file_name as string,
    // Formatted here, in one fixed zone, so the server and browser render the same text.
    uploadedAt: new Date(staged.created_at as string).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }),
    data,
    ...(await compareWithLive(supabase, data)),
  }
}

/** The changes `data` would make to the live data. Read-only. */
export async function compareWithLive(supabase: SupabaseClient, data: SchoolData) {
  const [{ data: depts }, { data: programs }, { data: profiles }, { data: offerings }, { data: subjects }] = await Promise.all([
    supabase.from('departments').select('id, name'),
    supabase.from('program_departments').select('program'),
    supabase.from('profiles').select('email, full_name, role, department_id, student_number, course, year_level, section'),
    supabase.from('class_offerings').select('section, subjects(subject_code), profiles!teacher_id(email, full_name)'),
    supabase.from('subjects').select('subject_code, department_id'),
  ])

  const deptName = new Map((depts ?? []).map((d) => [d.id as string, d.name as string]))
  const knownDepts = new Set((depts ?? []).map((d) => norm(d.name)))
  const knownPrograms = new Set((programs ?? []).map((p) => String(p.program)))
  const programDept = new Map(data.programs.map((p) => [p.code, p.department]))
  const staffName = new Map(data.staff.map((s) => [s.email, s.fullName]))

  // ── Accounts ──
  type Existing = { email: string; full_name: string; role: string; department_id: string | null; student_number: string | null; course: string | null; year_level: number | null; section: string | null }
  const byEmail = new Map(((profiles ?? []) as Existing[]).map((p) => [norm(p.email), p]))
  const inFile = new Set<string>()
  const newAccounts: ReviewItem[] = []
  const changedAccounts: ReviewItem[] = []
  const skippedAdmins: string[] = []
  let unchangedAccounts = 0

  const compare = (person: { email: string; fullName: string; role: string; department: string | null; studentNumber?: string; program?: string; yearLevel?: number; section?: string }) => {
    inFile.add(person.email)
    const p = byEmail.get(person.email)
    if (!p) { newAccounts.push({ label: person.fullName, detail: `${person.email} · ${ROLE_LABEL[person.role]}` }); return }
    if (p.role === 'admin') { skippedAdmins.push(person.email); return }
    const changes: string[] = []
    const diff = (what: string, before: unknown, after: unknown) => {
      if (norm(before) !== norm(after)) changes.push(`${what}: ${String(before ?? '') || '—'} → ${String(after ?? '') || '—'}`)
    }
    diff('Role', ROLE_LABEL[p.role] ?? p.role, ROLE_LABEL[person.role])
    diff('Name', p.full_name, person.fullName)
    diff('Department', p.department_id ? deptName.get(p.department_id) : '', person.department ?? '')
    // The import clears these for staff and sets them for students.
    diff('Section', p.section, person.section ?? '')
    diff('Course', p.course, person.program ?? '')
    diff('Year', p.year_level ?? '', person.yearLevel ?? '')
    diff('Student no.', p.student_number, person.studentNumber ?? '')
    if (changes.length) changedAccounts.push({ label: `${person.fullName} (${person.email})`, detail: changes.join(' · ') })
    else unchangedAccounts++
  }
  for (const s of data.staff) compare({ email: s.email, fullName: s.fullName, role: s.role, department: s.department })
  for (const s of data.students) {
    compare({ email: s.email, fullName: s.fullName, role: 'student', department: programDept.get(s.program) ?? null, studentNumber: s.studentNumber, program: s.program, yearLevel: s.yearLevel, section: s.section })
  }
  const keptAccounts = ((profiles ?? []) as Existing[])
    .filter((p) => p.role !== 'admin' && !inFile.has(norm(p.email)))
    .map((p) => ({ label: p.full_name, detail: `${p.email} · ${ROLE_LABEL[p.role] ?? p.role}` }))

  // ── Classes (replaced as a whole list) ──
  type Offering = { section: string; subjects: { subject_code: string } | null; profiles: { email: string; full_name: string } | null }
  const current = new Map<string, { email: string; name: string } | null>()
  for (const o of (offerings ?? []) as unknown as Offering[]) {
    current.set(`${o.section}|${o.subjects?.subject_code ?? ''}`, o.profiles ? { email: norm(o.profiles.email), name: o.profiles.full_name } : null)
  }
  const fileClasses = new Set<string>()
  const addedClasses: string[] = []
  const teacherChanges: ReviewItem[] = []
  let unchangedClasses = 0
  for (const c of data.classes) {
    const key = `${c.section}|${c.code}`
    fileClasses.add(key)
    if (!current.has(key)) { addedClasses.push(`${c.section} · ${c.code}`); continue }
    const was = current.get(key)
    if (was?.email !== c.teacherEmail) {
      teacherChanges.push({ label: `${c.section} · ${c.code}`, detail: `${was?.name ?? 'No teacher'} → ${staffName.get(c.teacherEmail) ?? c.teacherEmail}` })
    } else unchangedClasses++
  }
  const removedClasses = [...current.keys()].filter((k) => !fileClasses.has(k)).map((k) => k.replace('|', ' · '))

  // ── Subjects (kept once per code + department) ──
  const knownSubjects = new Set((subjects ?? []).map((s) => `${s.subject_code}|${norm(s.department_id ? deptName.get(s.department_id as string) : '')}`))
  const fileSubjects = new Map<string, string>()
  for (const c of data.classes) {
    const dept = programDept.get(c.program) ?? ''
    fileSubjects.set(`${c.code}|${norm(dept)}`, `${c.code} ${data.subjectNames[c.code] ?? ''} (${dept})`)
  }
  const newSubjects = [...fileSubjects].filter(([k]) => !knownSubjects.has(k)).map(([, label]) => label)
  const leftoverSubjects = [...knownSubjects].filter((k) => !fileSubjects.has(k)).length

  return {
    newDepartments: data.departments.filter((d) => !knownDepts.has(norm(d))),
    newPrograms: data.programs.filter((p) => !knownPrograms.has(p.code)).map((p) => `${p.code} — ${p.name}`),
    newAccounts,
    changedAccounts,
    unchangedAccounts,
    skippedAdmins,
    keptAccounts,
    addedClasses,
    removedClasses,
    teacherChanges,
    unchangedClasses,
    newSubjects,
    leftoverSubjects,
  }
}
