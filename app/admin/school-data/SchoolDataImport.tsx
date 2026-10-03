'use client'

import { useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { readSchoolData, PEOPLE_CHUNK_SIZE, type SchoolData, type Issue } from '@/lib/schoolData'
import { importStructure, importPeopleChunk, importClasses, stageImport, discardStagedImport, type PersonInput } from './actions'
import type { ImportReview, ReviewItem } from './review'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const card = 'ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-4'

interface Props {
  current: { departments: number; programs: number; staff: number; students: number; classes: number; subjects: number }
  /** The migration file still to run, or null when the database is ready. */
  migrationMissing: string | null
  /** The file waiting for review, compared with the live data. */
  review: ImportReview | null
}

interface Result { created: number; updated: number; classes: number; subjects: number; withoutTeacher: number; failures: { email: string; reason: string }[] }

/**
 * One workbook, one import: departments, programs, staff and student accounts,
 * subjects and classes. Students then sign in to find their section and
 * subjects already set; nothing else is configured in the app.
 *
 * Two steps: the checked file is uploaded for review (nothing changes yet),
 * the page shows what it would change, and Accept applies it — or Cancel
 * throws it away.
 */
export default function SchoolDataImport({ current, migrationMissing, review }: Props) {
  const [data, setData] = useState<SchoolData | null>(null)
  const [grids, setGrids] = useState<Record<string, unknown[][]> | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  // Bumped to clear the file picker once the file has been uploaded.
  const [inputKey, setInputKey] = useState(0)
  const [progress, setProgress] = useState<{ step: string; done: number; total: number } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    setData(null)
    setGrids(null)
    setResult(null)
    setRunError(null)
    if (!file.name.toLowerCase().endsWith('.xlsx')) return setFileError('Only .xlsx files are accepted.')
    if (file.size > MAX_FILE_SIZE) return setFileError('File exceeds the 10 MB limit.')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const sheets = Object.fromEntries(wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) as unknown[][]]))
        setGrids(sheets)
        setData(readSchoolData(sheets))
      } catch {
        setFileError('Could not read this file. Make sure it is a valid .xlsx file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function uploadForReview() {
    if (!grids) return
    setRunError(null)
    startTransition(async () => {
      const res = await stageImport({ fileName, grids })
      if (res.error) return setRunError(res.error)
      // The review card comes back from the server with the page.
      setData(null)
      setGrids(null)
      setInputKey((k) => k + 1)
    })
  }

  function cancelReview() {
    if (!review) return
    const id = review.id
    setRunError(null)
    startTransition(async () => {
      const res = await discardStagedImport(id)
      if (res.error) setRunError(res.error)
    })
  }

  function acceptReview() {
    if (!review) return
    const { id, data: file } = review
    setRunError(null)
    setResult(null)
    startTransition(async () => {
      const people: PersonInput[] = [
        ...file.staff.map((s) => ({ fullName: s.fullName, email: s.email, role: s.role, department: s.department })),
        ...file.students.map((s) => ({ fullName: s.fullName, email: s.email, role: 'student' as const, studentNumber: s.studentNumber, program: s.program, yearLevel: s.yearLevel, section: s.section })),
      ]

      setProgress({ step: 'Departments and programs', done: 0, total: 1 })
      const structure = await importStructure({ departments: file.departments, programs: file.programs })
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
      const cls = await importClasses({ classes: file.classes, subjectNames: file.subjectNames })
      setProgress(null)
      // On a failure the file stays waiting, so Accept can simply be pressed
      // again: every step updates what is already there instead of duplicating.
      if (cls.error) return setRunError(cls.error)

      await discardStagedImport(id)
      setResult({ created, updated, classes: cls.classes ?? 0, subjects: cls.subjects ?? 0, withoutTeacher: cls.withoutTeacher ?? 0, failures })
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
  const canUpload = !!data && !!grids && !data.errors.length && !isPending && !migrationMissing
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
          Run <code>{migrationMissing}</code> in the Supabase SQL editor first.
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
            <code>Classes</code>. Every sheet is checked against the others, then you review what would change before
            anything is saved.
          </p>
        </div>
        <input
          key={inputKey}
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
                Nothing is saved yet. Upload it to see what it would change — you then accept or cancel.
                {review && ' It replaces the file already waiting for review.'}
              </p>
              <button
                type="button"
                onClick={uploadForReview}
                disabled={!canUpload}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
              >
                {isPending ? 'Uploading…' : 'Upload for review'}
              </button>
            </>
          )}
        </section>
      )}

      {review && !result && (
        <ReviewPanel review={review} busy={isPending} onAccept={acceptReview} onCancel={cancelReview} />
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

/** What the waiting file would change, with Accept and Cancel. */
function ReviewPanel({ review, busy, onAccept, onCancel }: { review: ImportReview; busy: boolean; onAccept: () => void; onCancel: () => void }) {
  const d = review.data
  const tiles = [
    ['New accounts', review.newAccounts.length],
    ['Changed accounts', review.changedAccounts.length],
    ['Classes added', review.addedClasses.length],
    ['Classes removed', review.removedClasses.length],
    ['Teacher changes', review.teacherChanges.length],
    ['New subjects', review.newSubjects.length],
  ] as const

  return (
    <section className={`${card} border-2`} style={{ borderColor: 'var(--sti-gold)' }} aria-labelledby="review-title">
      <div>
        <h3 id="review-title" className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Review before importing</h3>
        <p className="text-xs ef-muted mt-0.5">
          {review.fileName} · uploaded {review.uploadedAt} · {d.staff.length} staff, {d.students.length} students,{' '}
          {d.classes.length} classes
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--card-foreground)' }}>
          <strong>Nothing has changed yet.</strong> Accept applies this file; Cancel throws it away.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
        {tiles.map(([label, n]) => (
          <div key={label} className="rounded-lg border ef-border px-2 py-2.5">
            <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--card-foreground)' }}>{n}</p>
            <p className="text-2xs ef-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Changes title="new accounts" items={review.newAccounts} />
        <Changes title="accounts that change" items={review.changedAccounts} />
        <Changes title="teacher changes" items={review.teacherChanges} />
        <Changes title="classes added" items={review.addedClasses} />
        <Changes title="classes removed" items={review.removedClasses} />
        <Changes title="new subjects" items={review.newSubjects} />
        <Changes title="new departments" items={review.newDepartments} />
        <Changes title="new programs" items={review.newPrograms} />
        <Changes title="accounts not in this file — they stay as they are" items={review.keptAccounts} />
        <IssueList title="worth checking" issues={d.warnings} tone="var(--status-warning)" />
      </div>

      <ul className="text-xs ef-muted space-y-1 list-disc pl-5">
        <li>{review.unchangedAccounts} account{review.unchangedAccounts === 1 ? '' : 's'} and {review.unchangedClasses} class{review.unchangedClasses === 1 ? '' : 'es'} stay the same.</li>
        {review.keptAccounts.length > 0 && <li>Accounts not in this file are not deleted — remove them on the Users page if they should go.</li>}
        {review.leftoverSubjects > 0 && <li>{review.leftoverSubjects} subject{review.leftoverSubjects === 1 ? '' : 's'} in the system {review.leftoverSubjects === 1 ? 'is' : 'are'} not in this file — kept, with no classes.</li>}
        {review.skippedAdmins.length > 0 && <li>Admin accounts are never changed by an import: {review.skippedAdmins.join(', ')}.</li>}
        <li>New accounts have no password — people sign in with their Microsoft school account. Submitted requests keep their teacher.</li>
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {busy ? 'Working…' : 'Accept and import'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold border ef-border disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: 'var(--card-foreground)' }}
        >
          Cancel
        </button>
      </div>
    </section>
  )
}

function Changes({ title, items }: { title: string; items: (ReviewItem | string)[] }) {
  if (!items.length) return null
  return (
    <details>
      <summary className="text-sm font-medium cursor-pointer" style={{ color: 'var(--card-foreground)' }}>
        {items.length} {title}
      </summary>
      <ul className="mt-2 space-y-1 text-xs ef-muted list-disc pl-5 max-h-64 overflow-y-auto">
        {items.map((item, n) => (
          <li key={n}>
            {typeof item === 'string' ? item : <><strong style={{ color: 'var(--card-foreground)' }}>{item.label}</strong> — {item.detail}</>}
          </li>
        ))}
      </ul>
    </details>
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
