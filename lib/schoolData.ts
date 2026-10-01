/**
 * Reads the school data workbook — one .xlsx, five sheets — that the admin
 * uploads on /admin/school-data. The real enrollment records are
 * confidential, so the school allowed a made-up but complete dataset instead:
 *
 *   Departments  Department
 *   Programs     Program Code · Program Name · Department
 *   Staff        Full Name · Email · Role · Department
 *   Students     Student Number · Full Name · Email · Program Code · Year Level · Section
 *   Classes      Section · Subject Code · Subject Name · Teacher Email
 *
 * Every sheet is checked against the others (a class's teacher must be on the
 * Staff sheet, a student's section must have classes, …) so the admin fixes
 * the file once instead of configuring anything in the app. Tertiary only.
 * Pure — no database, no imports — so it runs in the browser and can be tested
 * on its own.
 */

// People per import request: creating a login is one API call each, so the
// browser sends them in sequential chunks this size (it also drives the
// progress bar). Lives here because a 'use server' file may only export
// async functions.
export const PEOPLE_CHUNK_SIZE = 20

export type StaffRole = 'subject_teacher' | 'registrar' | 'program_head'

export interface Program { code: string; name: string; department: string }
export interface Staff { fullName: string; email: string; role: StaffRole; department: string | null }
export interface Student { studentNumber: string; fullName: string; email: string; program: string; yearLevel: number; section: string }
export interface ClassRow { section: string; program: string; yearLevel: number | null; code: string; subjectName: string; teacherEmail: string }
export interface Issue { sheet: string; row: number | null; message: string }

export interface SchoolData {
  departments: string[]
  programs: Program[]
  staff: Staff[]
  students: Student[]
  classes: ClassRow[]
  /** Subject code → name (the most common spelling in the file). */
  subjectNames: Record<string, string>
  errors: Issue[]
  warnings: Issue[]
}

export const SHEETS = {
  Departments: ['Department'],
  Programs: ['Program Code', 'Program Name', 'Department'],
  Staff: ['Full Name', 'Email', 'Role', 'Department'],
  Students: ['Student Number', 'Full Name', 'Email', 'Program Code', 'Year Level', 'Section'],
  Classes: ['Section', 'Subject Code', 'Subject Name', 'Teacher Email'],
} as const
type SheetName = keyof typeof SHEETS

const ROLES: Record<string, StaffRole> = {
  'subject teacher': 'subject_teacher',
  teacher: 'subject_teacher',
  registrar: 'registrar',
  'program head': 'program_head',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()
const key = (s: string) => s.toLowerCase()

/** "BSIT 2-201" → BSIT. */
export function programOf(section: string): string {
  return (section.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase()
}

/** "BSIT 2-201" → 2. */
export function yearOf(section: string): number | null {
  const y = section.match(/^[A-Za-z]+\s+(\d)-/)?.[1]
  return y ? Number(y) : null
}

/** Rows of one sheet as objects keyed by its required columns, with their Excel row numbers. */
function readSheet(
  name: SheetName,
  grids: Record<string, unknown[][]>,
  errors: Issue[],
): { row: number; v: Record<string, string> }[] {
  const actual = Object.keys(grids).find((n) => key(n.trim()) === key(name))
  if (!actual) {
    errors.push({ sheet: name, row: null, message: `Sheet "${name}" is missing.` })
    return []
  }
  const grid = grids[actual]
  const wanted = SHEETS[name]
  const at = grid.findIndex((r) => {
    const cells = (r ?? []).map((c) => key(text(c)))
    return wanted.every((w) => cells.includes(key(w)))
  })
  if (at < 0) {
    errors.push({ sheet: name, row: null, message: `Needs the columns ${wanted.join(', ')}.` })
    return []
  }
  const head = grid[at].map((c) => key(text(c)))
  const out: { row: number; v: Record<string, string> }[] = []
  grid.slice(at + 1).forEach((r, i) => {
    const v: Record<string, string> = {}
    for (const w of wanted) v[w] = text(r?.[head.indexOf(key(w))])
    if (Object.values(v).some(Boolean)) out.push({ row: at + 2 + i, v })
  })
  return out
}

export function readSchoolData(grids: Record<string, unknown[][]>): SchoolData {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const err = (sheet: string, row: number | null, message: string) => errors.push({ sheet, row, message })

  // Departments
  const departments: string[] = []
  const deptByKey = new Map<string, string>()
  for (const { row, v } of readSheet('Departments', grids, errors)) {
    const d = v.Department
    if (!d) continue
    if (deptByKey.has(key(d))) err('Departments', row, `"${d}" is listed twice.`)
    else { deptByKey.set(key(d), d); departments.push(d) }
  }
  const dept = (sheet: string, row: number, d: string) => {
    const found = deptByKey.get(key(d))
    if (!found) err(sheet, row, `Department "${d}" is not on the Departments sheet.`)
    return found ?? null
  }

  // Programs
  const programs: Program[] = []
  const programByCode = new Map<string, Program>()
  for (const { row, v } of readSheet('Programs', grids, errors)) {
    const code = v['Program Code'].toUpperCase().replace(/[^A-Z]/g, '')
    if (!code) { err('Programs', row, 'Program Code is empty.'); continue }
    if (programByCode.has(code)) { err('Programs', row, `${code} is listed twice.`); continue }
    const d = dept('Programs', row, v.Department)
    if (!d) continue
    const p = { code, name: v['Program Name'] || code, department: d }
    programByCode.set(code, p)
    programs.push(p)
  }

  // Staff and students share one email space: an email is one account.
  const emailOwner = new Map<string, string>()
  const claim = (sheet: string, row: number, email: string) => {
    if (!EMAIL.test(email)) { err(sheet, row, `"${email}" is not an email address.`); return false }
    const prev = emailOwner.get(email)
    if (prev) { err(sheet, row, `${email} is already used (${prev}).`); return false }
    emailOwner.set(email, `${sheet} row ${row}`)
    return true
  }

  const staff: Staff[] = []
  for (const { row, v } of readSheet('Staff', grids, errors)) {
    const email = v.Email.toLowerCase()
    const role = ROLES[key(v.Role)]
    if (!v['Full Name']) { err('Staff', row, 'Full Name is empty.'); continue }
    if (!role) { err('Staff', row, `Role "${v.Role}" must be Subject Teacher, Registrar or Program Head.`); continue }
    if (!claim('Staff', row, email)) continue
    const d = v.Department ? dept('Staff', row, v.Department) : null
    if (role === 'program_head' && !d) { err('Staff', row, 'A Program Head needs a Department — it decides which requests they review.'); continue }
    staff.push({ fullName: v['Full Name'], email, role, department: d })
  }
  const teacherEmails = new Set(staff.filter((s) => s.role === 'subject_teacher').map((s) => s.email))

  // Classes
  const classes: ClassRow[] = []
  const seen = new Map<string, number>()
  const names = new Map<string, Map<string, { name: string; n: number }>>()
  for (const { row, v } of readSheet('Classes', grids, errors)) {
    const section = v.Section.toUpperCase()
    const code = v['Subject Code'].toUpperCase().replace(/\s+/g, '')
    const teacherEmail = v['Teacher Email'].toLowerCase()
    const program = programOf(section)
    if (!section || !code) { err('Classes', row, 'Section and Subject Code are required.'); continue }
    if (!programByCode.has(program)) { err('Classes', row, `Section ${section} starts with ${program || '(nothing)'}, which is not on the Programs sheet.`); continue }
    if (!teacherEmails.has(teacherEmail)) { err('Classes', row, `Teacher ${teacherEmail || '(empty)'} is not a Subject Teacher on the Staff sheet.`); continue }
    const k = `${section}|${code}`
    if (seen.has(k)) { err('Classes', row, `${section} · ${code} is already on row ${seen.get(k)}.`); continue }
    seen.set(k, row)
    const subjectName = v['Subject Name'] || code
    const votes = names.get(code) ?? new Map<string, { name: string; n: number }>()
    votes.set(key(subjectName), { name: votes.get(key(subjectName))?.name ?? subjectName, n: (votes.get(key(subjectName))?.n ?? 0) + 1 })
    names.set(code, votes)
    classes.push({ section, program, yearLevel: yearOf(section), code, subjectName, teacherEmail })
  }
  const subjectNames: Record<string, string> = {}
  for (const [code, votes] of names) {
    const ranked = [...votes.values()].sort((a, b) => b.n - a.n)
    subjectNames[code] = ranked[0].name
    if (ranked.length > 1) warnings.push({ sheet: 'Classes', row: null, message: `${code} has ${ranked.length} different names (${ranked.map((r) => r.name).join(' / ')}); “${ranked[0].name}” is used.` })
  }
  const sectionsWithClasses = new Set(classes.map((c) => c.section))

  // Students
  const students: Student[] = []
  const numbers = new Map<string, number>()
  for (const { row, v } of readSheet('Students', grids, errors)) {
    const email = v.Email.toLowerCase()
    const program = v['Program Code'].toUpperCase().replace(/[^A-Z]/g, '')
    const section = v.Section.toUpperCase()
    const yearLevel = Number(v['Year Level'])
    const studentNumber = v['Student Number'].replace(/\s+/g, '')
    if (!v['Full Name']) { err('Students', row, 'Full Name is empty.'); continue }
    if (!/^[0-9-]{4,20}$/.test(studentNumber)) { err('Students', row, `Student Number "${v['Student Number']}" must be digits.`); continue }
    if (numbers.has(studentNumber)) { err('Students', row, `Student Number ${studentNumber} is already on row ${numbers.get(studentNumber)}.`); continue }
    if (!programByCode.has(program)) { err('Students', row, `Program ${program || '(empty)'} is not on the Programs sheet.`); continue }
    if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 5) { err('Students', row, `Year Level "${v['Year Level']}" must be 1 to 5.`); continue }
    if (programOf(section) !== program) { err('Students', row, `Section ${section} doesn't belong to ${program}.`); continue }
    if (!sectionsWithClasses.has(section)) { err('Students', row, `Section ${section} has no classes on the Classes sheet.`); continue }
    if (!claim('Students', row, email)) continue
    numbers.set(studentNumber, row)
    students.push({ studentNumber, fullName: v['Full Name'], email, program, yearLevel, section })
  }

  // Worth knowing, but not blocking.
  const teaching = new Set(classes.map((c) => c.teacherEmail))
  for (const s of staff) {
    if (s.role === 'subject_teacher' && !teaching.has(s.email)) warnings.push({ sheet: 'Staff', row: null, message: `${s.fullName} teaches no class on the Classes sheet.` })
  }
  const withStudents = new Set(students.map((s) => s.section))
  const empty = [...sectionsWithClasses].filter((s) => !withStudents.has(s))
  if (empty.length) warnings.push({ sheet: 'Classes', row: null, message: `${empty.length} section${empty.length === 1 ? ' has' : 's have'} classes but no students: ${empty.slice(0, 8).join(', ')}${empty.length > 8 ? ', …' : ''}.` })

  return { departments, programs, staff, students, classes, subjectNames, errors, warnings }
}
