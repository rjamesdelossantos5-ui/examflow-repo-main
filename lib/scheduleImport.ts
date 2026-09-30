/**
 * Reads the registrar's class schedule Excel (one sheet per level, e.g.
 * "TER SCHED 2T2526" and "SHS SCHED 2T2526") into class offerings:
 * section → subject → instructor. Pure — no database, no imports — so the
 * admin page runs it in the browser and it can be tested on its own.
 *
 * What the real file does, and how it's handled (checked against the
 * 2nd-term 2025-26 file, 2026-09-30):
 *  - The header is not on row 1 (title rows sit above it): it is found by its
 *    column names instead.
 *  - A subject is split into LAB and LEC rows ("… - LAB", "…-LEC"): they are
 *    merged into one subject per section. In 97 of 100 splits both rows have
 *    the same instructor.
 *  - The other 3 are typos in the file: one subject code used for two
 *    different subjects in the same section (ENGR1014, INTE1084). Reported as
 *    an issue; the first subject is kept.
 *  - Instructors are surnames only ("CO", "SANTOS, M"); the admin matches each
 *    one to a teacher account once (see suggestTeacher).
 *  - Senior High writes "TERTIARY" as the instructor with the name in
 *    REMARKS; it is kept as "TERTIARY (REYES)" so it can be matched too.
 */

export interface ScheduleRow {
  sheet: string
  excelRow: number
  section: string
  code: string
  description: string
  instructor: string
}

export interface SheetSummary {
  name: string
  usable: boolean
  classRows: number
  sections: number
  reason?: string
}

export interface ScheduleOffering {
  section: string
  program: string
  yearLevel: number | null
  code: string
  name: string
  /** Instructor as written in the file, normalised to upper case ("" = none). */
  instructor: string
}

export interface ScheduleIssue {
  kind: 'code-two-subjects' | 'two-instructors' | 'no-instructor'
  message: string
}

export interface ParsedSchedule {
  offerings: ScheduleOffering[]
  /** Subject code → name used for it (the most common spelling in the file). */
  subjectNames: Record<string, string>
  programs: string[]
  instructors: { alias: string; classes: number }[]
  issues: ScheduleIssue[]
}

const cell = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()

/** Reads one sheet. A sheet without SECTION / COURSE CODE / INSTRUCTOR columns is reported as not usable. */
export function readScheduleSheet(name: string, grid: unknown[][]): { rows: ScheduleRow[]; summary: SheetSummary } {
  const headerAt = grid.findIndex((r) => {
    const cells = (r ?? []).map((c) => cell(c).toUpperCase())
    return cells.includes('SECTION') && cells.includes('COURSE CODE') && cells.some((c) => c.startsWith('INSTRUCTOR'))
  })
  if (headerAt < 0) {
    return { rows: [], summary: { name, usable: false, classRows: 0, sections: 0, reason: 'No SECTION / COURSE CODE / INSTRUCTOR header' } }
  }

  const head = grid[headerAt].map((c) => cell(c).toUpperCase())
  const col = (prefix: string) => head.findIndex((h) => h.startsWith(prefix))
  const S = col('SECTION'), C = col('COURSE CODE'), D = col('COURSE DESC'), I = col('INSTRUCTOR'), R = col('REMARKS')

  const rows: ScheduleRow[] = []
  let current = ''
  let explicit = 0
  grid.slice(headerAt + 1).forEach((r, i) => {
    const sec = cell(r?.[S])
    if (sec) current = sec
    const code = cell(r?.[C]).toUpperCase()
    if (!code || !current) return
    if (sec) explicit++
    const raw = cell(r?.[I]).toUpperCase()
    const remarks = R >= 0 ? cell(r?.[R]).toUpperCase() : ''
    rows.push({
      sheet: name,
      excelRow: headerAt + 2 + i,
      section: current.toUpperCase(),
      code,
      description: D >= 0 ? cell(r?.[D]) : '',
      instructor: raw === 'TERTIARY' && remarks ? `TERTIARY (${remarks})` : raw,
    })
  })

  const sections = new Set(rows.map((r) => r.section)).size
  // A summary sheet that lists classes without their sections would route
  // every row to whatever section happened to come last.
  const usable = rows.length > 0 && explicit / rows.length >= 0.8
  return {
    rows: usable ? rows : [],
    summary: {
      name,
      usable,
      classRows: rows.length,
      sections,
      reason: usable ? undefined : rows.length ? 'Most rows have no SECTION' : 'No class rows under the header',
    },
  }
}

/** "BSIT 2-201" → BSIT, "STEM1101" → STEM. */
export function programOf(section: string): string {
  return (section.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase()
}

/** "BSIT 2-201" → 2. Senior High sections ("STEM1101") → null, so any year works on the form. */
export function yearOf(section: string): number | null {
  const y = section.match(/^[A-Za-z]+\s+(\d)-/)?.[1]
  return y ? Number(y) : null
}

/** "Accounting Information System-LEC" → "Accounting Information System". */
export function baseSubjectName(description: string): string {
  return cell(description)
    .replace(/[\s\-–(]*\b(LAB|LEC|LECTURE|LABORATORY)\b\)?\s*$/i, '')
    .trim()
}

const sameName = (s: string) => s.toLowerCase().replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim()

export function buildSchedule(rows: ScheduleRow[]): ParsedSchedule {
  const issues: ScheduleIssue[] = []

  // Merge LAB/LEC rows: one offering per section + subject code.
  const groups = new Map<string, ScheduleRow[]>()
  for (const r of rows) {
    const k = `${r.section}|${r.code}`
    const g = groups.get(k)
    if (g) g.push(r)
    else groups.set(k, [r])
  }

  const offerings: ScheduleOffering[] = []
  const nameVotes = new Map<string, Map<string, { name: string; n: number }>>()
  const classesByInstructor = new Map<string, number>()

  for (const g of groups.values()) {
    const first = g[0]
    const names = [...new Map(g.map((r) => [sameName(baseSubjectName(r.description)), baseSubjectName(r.description)])).values()]
    const instructors = [...new Set(g.map((r) => r.instructor).filter(Boolean))]
    const where = `${first.section} · ${first.code} (${first.sheet}, row ${first.excelRow})`
    if (names.length > 1) {
      issues.push({ kind: 'code-two-subjects', message: `${where}: the same code has ${names.length} different subject names — ${names.join(' / ')}. “${names[0]}” is used for this section. If these are different subjects, fix the code in the file and upload again.` })
    }
    if (instructors.length > 1) {
      issues.push({ kind: 'two-instructors', message: `${where}: ${instructors.length} instructors (${instructors.join(' / ')}). ${instructors[0]} is used.` })
    }
    if (!instructors.length) {
      issues.push({ kind: 'no-instructor', message: `${where}: no instructor in the file.` })
    }

    const instructor = instructors[0] ?? ''
    if (instructor) classesByInstructor.set(instructor, (classesByInstructor.get(instructor) ?? 0) + 1)
    offerings.push({
      section: first.section,
      program: programOf(first.section),
      yearLevel: yearOf(first.section),
      code: first.code,
      name: names[0] ?? first.code,
      instructor,
    })

    const votes = nameVotes.get(first.code) ?? new Map<string, { name: string; n: number }>()
    const key = sameName(names[0] ?? first.code)
    votes.set(key, { name: votes.get(key)?.name ?? names[0] ?? first.code, n: (votes.get(key)?.n ?? 0) + 1 })
    nameVotes.set(first.code, votes)
  }

  const subjectNames: Record<string, string> = {}
  for (const [code, votes] of nameVotes) {
    subjectNames[code] = [...votes.values()].sort((a, b) => b.n - a.n)[0].name
  }

  return {
    offerings: offerings.sort((a, b) => a.section.localeCompare(b.section) || a.code.localeCompare(b.code)),
    subjectNames,
    programs: [...new Set(offerings.map((o) => o.program).filter(Boolean))].sort(),
    instructors: [...classesByInstructor].map(([alias, classes]) => ({ alias, classes })).sort((a, b) => a.alias.localeCompare(b.alias)),
    issues,
  }
}

// ── teacher matching ────────────────────────────────────────────────────────

const TITLES = new Set(['instructor', 'teacher', 'prof', 'professor', 'dr', 'mr', 'mrs', 'ms', 'miss', 'sir', 'maam', 'engr', 'atty', 'test'])

/** A teacher account's surname and first-name initial, from "Joshua Galamiton", "Instructor Kid Valles" or "Galamiton, Joshua". */
function nameParts(fullName: string): { surname: string; initial: string } {
  const clean = fullName.replace(/\([^)]*\)/g, ' ').replace(/[–—]/g, ' ').trim()
  const words = (s: string) => s.split(/\s+/).map((w) => w.replace(/[^\p{L}'-]/gu, '')).filter(Boolean)
  if (clean.includes(',')) {
    const [sur, given] = clean.split(',', 2)
    return { surname: words(sur).join(' ').toUpperCase(), initial: (words(given)[0]?.[0] ?? '').toUpperCase() }
  }
  const w = words(clean).filter((x, i, all) => !(i < all.length - 1 && TITLES.has(x.toLowerCase())))
  return { surname: (w[w.length - 1] ?? '').toUpperCase(), initial: (w.length > 1 ? w[0][0] : '').toUpperCase() }
}

/**
 * Suggests the teacher account for a schedule instructor ("SANTOS, M" →
 * the one teacher surnamed Santos whose first name starts with M). Only a
 * single clear match is suggested; the admin confirms or picks one.
 */
export function suggestTeacher(alias: string, teachers: { id: string; full_name: string }[]): string | null {
  const inner = alias.match(/^TERTIARY \((.+)\)$/)?.[1] ?? alias
  const [sur, init] = inner.split(',').map((s) => s.trim())
  const surname = sur.toUpperCase()
  const initial = (init?.[0] ?? '').toUpperCase()
  if (!surname) return null
  const hits = teachers.filter((t) => {
    const p = nameParts(t.full_name)
    const lastWord = p.surname.split(' ').pop() ?? ''
    return (p.surname === surname || lastWord === surname) && (!initial || p.initial === initial)
  })
  return hits.length === 1 ? hits[0].id : null
}
