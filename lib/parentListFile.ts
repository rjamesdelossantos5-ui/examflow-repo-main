/**
 * Reads the Registrar's student–parent list: one .xlsx, one row per student.
 *
 *   Student Number · Student Name · Father · Mother · Guardian · Guardian Relationship
 *
 * Father, Mother and Guardian may each be empty, but a student needs at least
 * one. Guardian is anyone else who looks after the student — a grandmother, an
 * aunt — with Guardian Relationship saying who ("Grandmother"); left empty it
 * reads "Guardian". The header row is found by its column names, so a title
 * row above it is fine. Pure — runs in the browser and can be tested alone.
 */

export interface ParentListRow {
  studentNumber: string
  studentName: string
  people: { name: string; relationship: string }[]
}
export interface ParentListIssue { row: number | null; message: string }
export interface ParentListData { rows: ParentListRow[]; errors: ParentListIssue[]; warnings: ParentListIssue[] }

export const PARENT_LIST_COLUMNS = ['Student Number', 'Student Name', 'Father', 'Mother', 'Guardian', 'Guardian Relationship'] as const

const key = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const text = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max)

export function readParentList(grids: Record<string, unknown[][]>): ParentListData {
  const errors: ParentListIssue[] = []
  const warnings: ParentListIssue[] = []

  // The first sheet with a "Student Number" header and at least one name column.
  let grid: unknown[][] | null = null
  let headerAt = -1
  let col: Record<string, number> = {}
  for (const g of Object.values(grids)) {
    for (let r = 0; r < Math.min(g.length, 10); r++) {
      const cells = (g[r] ?? []).map(key)
      const at = (name: string) => cells.indexOf(name.toLowerCase())
      if (at('Student Number') >= 0 && ['Father', 'Mother', 'Guardian'].some((n) => at(n) >= 0)) {
        grid = g
        headerAt = r
        col = Object.fromEntries(PARENT_LIST_COLUMNS.map((n) => [n, at(n)]))
        break
      }
    }
    if (grid) break
  }
  if (!grid) {
    errors.push({ row: null, message: 'No header row found. Row 1 needs "Student Number" and at least one of "Father", "Mother" or "Guardian".' })
    return { rows: [], errors, warnings }
  }

  const cell = (row: unknown[], name: string, max = 200) => (col[name] >= 0 ? text(row[col[name]], max) : '')
  const rows: ParentListRow[] = []
  const seen = new Map<string, number>()

  for (let r = headerAt + 1; r < grid.length; r++) {
    const row = grid[r] ?? []
    const excelRow = r + 1
    if (row.every((c) => text(c, 1) === '')) continue

    const studentNumber = cell(row, 'Student Number', 40).replace(/\D/g, '')
    if (studentNumber.length < 4 || studentNumber.length > 20) {
      errors.push({ row: excelRow, message: `Student Number "${cell(row, 'Student Number', 40)}" must be digits.` })
      continue
    }
    if (seen.has(studentNumber)) {
      errors.push({ row: excelRow, message: `Student Number ${studentNumber} is already on row ${seen.get(studentNumber)}.` })
      continue
    }
    seen.set(studentNumber, excelRow)

    const guardian = cell(row, 'Guardian')
    const relationship = cell(row, 'Guardian Relationship', 60)
    if (relationship && !guardian) warnings.push({ row: excelRow, message: `Guardian Relationship "${relationship}" has no Guardian name — ignored.` })

    const people: ParentListRow['people'] = []
    for (const [name, rel] of [[cell(row, 'Father'), 'Father'], [cell(row, 'Mother'), 'Mother'], [guardian, relationship || 'Guardian']] as const) {
      if (!name) continue
      if (people.some((p) => key(p.name) === key(name))) {
        warnings.push({ row: excelRow, message: `${name} is listed twice for this student — kept once.` })
        continue
      }
      people.push({ name, relationship: rel })
    }
    if (!people.length) {
      errors.push({ row: excelRow, message: `Student ${studentNumber} has no Father, Mother or Guardian.` })
      continue
    }
    rows.push({ studentNumber, studentName: cell(row, 'Student Name'), people })
  }

  if (!rows.length && !errors.length) errors.push({ row: null, message: 'The list has no students.' })
  return { rows, errors, warnings }
}
