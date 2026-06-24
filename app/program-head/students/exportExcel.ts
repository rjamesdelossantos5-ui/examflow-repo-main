// Builds the school-standard "Special Exam Application" workbook with exceljs.
// Mirrors the official template: PAID + WAIVED sheets (merged title rows, the
// dark-red deadline banner, Arial fonts, thin borders, exact column widths) and
// a Summary sheet that auto-counts applications per subject.

export interface ExportRow {
  exam_type: string
  excused_reason: string | null
  other_reason: string | null
  submitted_at: string
  student_name: string
  course: string | null
  year_level: number | null
  section: string | null
  subject_code: string
  subject_name: string
}

// ── School-standard text (update these each exam period) ──────────────
const DEADLINE_LABEL = "Deadline of School's Submission of this List:"
const EXAM_PERIOD = 'Midterm/3Q Examination'
const DEADLINE_TEXT = 'on or before April 6, 2026, 12:00 NN'

const ARIAL = 'Arial'
const RED = 'FFC00000'           // deadline banner
const BLUE_TITLE = 'FFBDD7EE'    // light blue — title rows
const PEACH_HEADER = 'FFFCE4D6'  // peach — header row
const BLUE_BAND = 'FFDDEBF7'     // lighter blue — banded data rows
const thin = { style: 'thin' as const, color: { argb: 'FF000000' } }
const allBorders = { top: thin, left: thin, bottom: thin, right: thin }

function solid(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } }
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

function sectionStr(r: ExportRow) {
  if (r.course && r.year_level != null && r.section) return `${r.course} ${r.year_level}-${r.section}`
  return [r.course, r.section].filter(Boolean).join(' ') || '—'
}

function reasonStr(r: ExportRow) {
  if (r.other_reason) return r.other_reason
  if (r.excused_reason === 'medical') return 'Medical reason. (w/ medical certificate)'
  if (r.excused_reason === 'bereavement') return 'Death in the family. (w/ death certificate)'
  return 'Valid reason (as approved by SA and SD)'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WS = any

function buildListSheet(wb: WS, name: string, rows: ExportRow[], withReason: boolean) {
  const ws = wb.addWorksheet(name)
  const size = withReason ? 11 : 12
  const lastCol = withReason ? 7 : 6
  const lastColLetter = withReason ? 'G' : 'F'
  const dataEndCol = withReason ? 'D' : 'D'

  const widths = withReason
    ? [22.33, 27.33, 24.33, 51, 24.66, 24.66, 75.33]
    : [21.33, 35.33, 18, 74, 32.33, 47]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const redCell = (cell: WS, value: WS, bold = true) => {
    cell.value = value
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } }
    cell.font = { name: ARIAL, size, bold, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = allBorders
  }

  // ── Row 1: title + deadline label ──
  ws.mergeCells(`A1:${dataEndCol}1`)
  const t1 = ws.getCell('A1')
  if (withReason) {
    t1.value = {
      richText: [
        { text: 'Special Exam Application (For Waived Special Exam Fee ', font: { name: ARIAL, size } },
        { text: 'as Approved by SA and SD', font: { name: ARIAL, size, color: { argb: 'FFFF0000' } } },
        { text: ')', font: { name: ARIAL, size } },
      ],
    }
  } else {
    t1.value = 'Special Exam Application'
    t1.font = { name: ARIAL, size, bold: true }
  }
  t1.alignment = { horizontal: 'center', vertical: 'middle' }
  t1.border = allBorders
  t1.fill = solid(BLUE_TITLE)
  ws.mergeCells(`E1:${lastColLetter}1`)
  redCell(ws.getCell('E1'), DEADLINE_LABEL)

  // ── Row 2: exam period + deadline text ──
  ws.mergeCells(`A2:${dataEndCol}2`)
  const t2 = ws.getCell('A2')
  t2.value = EXAM_PERIOD
  t2.font = { name: ARIAL, size }
  t2.alignment = { horizontal: 'center', vertical: 'middle' }
  t2.border = allBorders
  t2.fill = solid(BLUE_TITLE)
  ws.mergeCells(`E2:${lastColLetter}2`)
  redCell(ws.getCell('E2'), DEADLINE_TEXT)

  // ── Row 3: headers ──
  const headers = [
    'Date of Application',
    withReason ? 'Student Name' : 'Student Name\n(Last Name, First Name, MI)',
    'Section',
    'Course/Subject Title',
    'Course/Subject Code',
    'Program/Strand',
    ...(withReason ? ['Reason'] : []),
  ]
  const hr = ws.getRow(3)
  hr.height = withReason ? 18 : 31.2
  headers.forEach((h, i) => {
    const cell = hr.getCell(i + 1)
    cell.value = h
    cell.font = { name: ARIAL, size, bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = allBorders
    cell.fill = solid(PEACH_HEADER)
  })
  // Filter dropdowns on the header (like the original Table)
  ws.autoFilter = `A3:${lastColLetter}3`

  // ── Data rows (with light-blue row banding) ──
  rows.forEach((r, idx) => {
    const row = ws.getRow(4 + idx)
    const values = [
      fmtDate(r.submitted_at),
      r.student_name,
      sectionStr(r),
      r.subject_name,
      r.subject_code,
      r.course ?? '',
      ...(withReason ? [reasonStr(r)] : []),
    ]
    const banded = idx % 2 === 0
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v
      cell.font = { name: ARIAL, size }
      cell.alignment = { vertical: 'middle', wrapText: i === 3 || i === 6 }
      cell.border = allBorders
      if (banded) cell.fill = solid(BLUE_BAND)
    })
  })

  if (rows.length === 0) {
    const row = ws.getRow(4)
    ws.mergeCells(`A4:${lastColLetter}4`)
    const c = row.getCell(1)
    c.value = 'No applications in this category.'
    c.font = { name: ARIAL, size, italic: true }
    c.alignment = { horizontal: 'center' }
    c.border = allBorders
  }

  ws.views = [{ state: 'frozen', ySplit: 3 }]
}

function buildSummary(wb: WS, rows: ExportRow[]) {
  const ws = wb.addWorksheet('Summary')
  ws.getColumn(1).width = 22.78
  ws.getColumn(2).width = 40
  ws.getColumn(3).width = 10

  const headers = ['Subject Code', 'Subject / Course', 'Count']
  headers.forEach((h, i) => {
    const cell = ws.getRow(1).getCell(i + 1)
    cell.value = h
    cell.font = { name: ARIAL, size: 11, bold: true }
    cell.alignment = { horizontal: i === 2 ? 'center' : 'left', vertical: 'middle' }
    cell.border = allBorders
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
  })

  // Aggregate count per subject code (auto-count)
  const map = new Map<string, { name: string; count: number }>()
  for (const r of rows) {
    const key = r.subject_code || '—'
    const cur = map.get(key)
    if (cur) cur.count++
    else map.set(key, { name: r.subject_name, count: 1 })
  }
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  sorted.forEach(([code, { name, count }], idx) => {
    const row = ws.getRow(2 + idx)
    const cells = [code, name, count]
    cells.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v
      cell.font = { name: ARIAL, size: 11 }
      cell.alignment = { horizontal: i === 2 ? 'center' : 'left', vertical: 'middle' }
      cell.border = allBorders
    })
  })

  // Total row
  const totalRow = ws.getRow(2 + sorted.length)
  totalRow.getCell(2).value = 'TOTAL'
  totalRow.getCell(2).font = { name: ARIAL, size: 11, bold: true }
  totalRow.getCell(2).alignment = { horizontal: 'right' }
  totalRow.getCell(2).border = allBorders
  totalRow.getCell(3).value = rows.length
  totalRow.getCell(3).font = { name: ARIAL, size: 11, bold: true }
  totalRow.getCell(3).alignment = { horizontal: 'center' }
  totalRow.getCell(3).border = allBorders
  totalRow.getCell(1).border = allBorders

  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

export async function exportSchoolFormat(rows: ExportRow[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'EXAMFLOW'

  buildListSheet(wb, 'PAID SPECIAL EXAM', rows.filter((r) => r.exam_type === 'paid'), false)
  buildListSheet(wb, 'WAIVED FEE (VALID REASON)', rows.filter((r) => r.exam_type === 'excused'), true)
  buildSummary(wb, rows)

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Special-Exam-Application_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
