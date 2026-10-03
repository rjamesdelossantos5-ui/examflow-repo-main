'use client'

import { useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { readSchoolData, PEOPLE_CHUNK_SIZE, type SchoolData, type Issue } from '@/lib/schoolData'
import { importStructure, importPeopleChunk, importClasses, type PersonInput } from './actions'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const card = 'ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-4'

interface Props {
  current: { departments: number; programs: number; staff: number; students: number; classes: number; subjects: number }
  migrationMissing: boolean
}

interface Result { created: number; updated: number; classes: number; subjects: number; withoutTeacher: number; failures: { email: string; reason: string }[] }

/**
 * One workbook, one import: departments, programs, staff and student accounts,
 * subjects and classes. Students then sign in to find their section and
 * subjects already set; nothing else is configured in the app.
 */
export default function SchoolDataImport({ current, migrationMissing }: Props) {
  const [data, setData] = useState<SchoolData | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ step: string; done: number; total: number } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    setData(null)
    setResult(null)
    setRunError(null)
    if (!file.name.toLowerCase().endsWith('.xlsx')) return setFileError('Only .xlsx files are accepted.')
    if (file.size > MAX_FILE_SIZE) return setFileError('File exceeds the 10 MB limit.')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const grids = Object.fromEntries(wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) as unknown[][]]))
        setData(readSchoolData(grids))
      } catch {
        setFileError('Could not read this file. Make sure it is a valid .xlsx file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function runImport() {
    if (!data) return
    setRunError(null)
    startTransition(async () => {
      const people: PersonInput[] = [
        ...data.staff.map((s) => ({ fullName: s.fullName, email: s.email, role: s.role, department: s.department })),
        ...data.students.map((s) => ({ fullName: s.fullName, email: s.email, role: 'student' as const, studentNumber: s.studentNumber, program: s.program, yearLevel: s.yearLevel, section: s.section })),
      ]

      setProgress({ step: 'Departments and programs', done: 0, total: 1 })
      const structure = await importStructure({ departments: data.departments, programs: data.programs })
      if (structure.error) { setProgress(null); return setRunError(structure.error) }

      let created = 0, updated = 0
      const failures: Result['failures'] = []
      for (let i = 0; i < people.length; i += PEOPLE_CHUNK_SIZE) {
        setProgress({ step: 'Accounts', done: i, total: people.length })
        const res = await importPeopleChunk(people.slice(i, i + PEOPLE_CHUNK_SIZE))
        if (res.error) { setProgress(null); return setRunError(res.error) }
        created += res.created
        updated += res.updated
        failures.push(...res.failures)
      }

      setProgress({ step: 'Subjects and classes', done: 0, total: 1 })
      const cls = await importClasses({ classes: data.classes, subjectNames: data.subjectNames })
      setProgress(null)
      if (cls.error) return setRunError(cls.error)
      setResult({ created, updated, classes: cls.classes ?? 0, subjects: cls.subjects ?? 0, withoutTeacher: cls.withoutTeacher ?? 0, failures })
      setData(null)
    })
  }

  const counts = [
    ['Departments', current.departments],
    ['Programs', current.programs],
    ['Staff', current.staff],
    ['Students', current.students],
    ['Subjects', current.subjects],
    ['Classes', current.classes],
  ] as const
  const canImport = !!data && !data.errors.length && !isPending && !migrationMissing
  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>School Data</h2>
        <p className="text-sm ef-muted mt-1">
          Upload one Excel file with the school&apos;s departments, programs, staff, students and classes. Students then
          sign in to find their details, section and subjects already there — the teacher for each subject is filled in
          for them.
        </p>
      </div>

      {migrationMissing && (
        <div role="alert" className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--status-danger)', color: 'var(--status-danger)' }}>
          Run <code>supabase/migration_school_data.sql</code> in the Supabase SQL editor first.
        </div>
      )}

      <section className={card}>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
          {counts.map(([label, n]) => (
            <div key={label} className="rounded-lg border ef-border px-2 py-2.5">
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--card-foreground)' }}>{n}</p>
              <p className="text-2xs ef-muted">{label}</p>
            </div>
          ))}
        </div>
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Upload the school data file</h3>
          <p className="text-2xs sm:text-xs ef-muted mt-1">
            Five sheets: <code>Departments</code>, <code>Programs</code>, <code>Staff</code>, <code>Students</code>,{' '}
            <code>Classes</code>. Every sheet is checked against the others before anything is saved.
          </p>
        </div>
        <input
          type="file"
          accept=".xlsx"
          onChange={handleFile}
          disabled={isPending}
          aria-label="Choose the school data Excel file"
          className="block w-full text-sm ef-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:cursor-pointer file:bg-[var(--sti-gold)] file:text-[var(--sti-navy)]"
        />
        {fileError && <p role="alert" className="text-xs" style={{ color: 'var(--status-danger)' }}>{fileError}</p>}
      </section>

      {data && (
        <section className={card}>
          <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>{fileName}</h3>
          <p className="text-sm" style={{ color: 'var(--card-foreground)' }}>
            {data.departments.length} departments · {data.programs.length} programs · {data.staff.length} staff ·{' '}
            {data.students.length} students · {Object.keys(data.subjectNames).length} subjects · {data.classes.length} classes
          </p>
          <IssueList title="must be fixed in the file" issues={data.errors} tone="var(--status-danger)" open />
          <IssueList title="worth checking" issues={data.warnings} tone="var(--status-warning)" />
          {!data.errors.length && (
            <>
              <p className="text-xs ef-muted">
                Accounts that already exist are updated, not duplicated. New accounts have no password — people sign in
                with their Microsoft school account. The class list is replaced; submitted requests keep their teacher.
              </p>
              <button
                type="button"
                onClick={runImport}
                disabled={!canImport}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
              >
                {isPending ? 'Importing…' : 'Import school data'}
              </button>
            </>
          )}
        </section>
      )}

      {progress && (
        <section className={card} aria-live="polite">
          <p className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>
            {progress.step}{progress.total > 1 ? ` — ${progress.done} of ${progress.total}` : '…'}
          </p>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div className="h-full transition-[width] duration-300 ease-[var(--ease-out)]" style={{ width: `${progress.total > 1 ? pct : 100}%`, background: 'var(--sti-gold)' }} />
          </div>
        </section>
      )}

      {runError && <p role="alert" className="text-sm" style={{ color: 'var(--status-danger)' }}>{runError}</p>}

      {result && (
        <section className={card}>
          <p className="font-semibold" style={{ color: 'var(--status-success)' }}>School data imported.</p>
          <ul className="text-sm space-y-1" style={{ color: 'var(--card-foreground)' }}>
            <li>{result.created} account{result.created === 1 ? '' : 's'} created, {result.updated} updated</li>
            <li>{result.subjects} subject entries and {result.classes} classes</li>
            {result.withoutTeacher > 0 && <li style={{ color: 'var(--status-warning)' }}>{result.withoutTeacher} classes have no teacher account — check the Staff sheet</li>}
          </ul>
          {result.failures.length > 0 && (
            <details>
              <summary className="text-xs cursor-pointer" style={{ color: 'var(--status-danger)' }}>
                {result.failures.length} account{result.failures.length === 1 ? '' : 's'} not imported — show
              </summary>
              <ul className="mt-2 space-y-1 text-2xs ef-muted max-h-48 overflow-y-auto">
                {result.failures.map((f, i) => <li key={i}><span className="font-mono">{f.email}</span> — {f.reason}</li>)}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  )
}

function IssueList({ title, issues, tone, open = false }: { title: string; issues: Issue[]; tone: string; open?: boolean }) {
  if (!issues.length) return null
  return (
    <details open={open}>
      <summary className="text-sm font-medium cursor-pointer" style={{ color: tone }}>
        {issues.length} {issues.length === 1 ? 'thing' : 'things'} {title}
      </summary>
      <ul className="mt-2 space-y-1 text-xs ef-muted list-disc pl-5 max-h-64 overflow-y-auto">
        {issues.map((i, n) => (
          <li key={n}><strong style={{ color: 'var(--card-foreground)' }}>{i.sheet}{i.row ? ` row ${i.row}` : ''}:</strong> {i.message}</li>
        ))}
      </ul>
    </details>
  )
}
