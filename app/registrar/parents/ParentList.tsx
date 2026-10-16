'use client'

import { useErrorToast } from '@/components/Toaster'
import { useMemo, useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import SearchInput from '@/components/SearchInput'
import { Icon } from '@/components/Icon'
import { readParentList, PARENT_LIST_COLUMNS, type ParentListData, type ParentListIssue } from '@/lib/parentListFile'
import { replaceParentList } from './actions'

export interface ListedStudent {
  studentNumber: string
  studentName: string
  people: { name: string; relationship: string }[]
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const card = 'ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-4'

/**
 * Upload and view the student–parent list. Nothing is saved until "Replace
 * the list" is pressed, and the server checks the file again before saving.
 */
export default function ParentList({ students, migrationMissing }: { students: ListedStudent[]; migrationMissing: boolean }) {
  const [file, setFile] = useState<{ name: string; grids: Record<string, unknown[][]>; data: ParentListData } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  useErrorToast(fileError)
  const [inputKey, setInputKey] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  useErrorToast(saveError)
  const [saved, setSaved] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? students.filter((s) => [s.studentNumber, s.studentName, ...s.people.map((p) => p.name)].some((v) => v.toLowerCase().includes(q)))
      : students
  }, [students, query])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setFile(null)
    setFileError(null)
    setSaveError(null)
    setSaved(null)
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.xlsx')) return setFileError('Only .xlsx files are accepted.')
    if (f.size > MAX_FILE_SIZE) return setFileError('File exceeds the 10 MB limit.')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const grids = Object.fromEntries(wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) as unknown[][]]))
        setFile({ name: f.name, grids, data: readParentList(grids) })
      } catch {
        setFileError('Could not read this file. Make sure it is a valid .xlsx file.')
      }
    }
    reader.readAsArrayBuffer(f)
  }

  function save() {
    if (!file) return
    const grids = file.grids
    setSaveError(null)
    startTransition(async () => {
      const res = await replaceParentList(grids)
      if (res.error) return setSaveError(res.error)
      setSaved(`Saved: ${res.students} student${res.students === 1 ? '' : 's'}, ${res.people} parent${res.people === 1 ? '' : 's'} and guardian${res.people === 1 ? '' : 's'}.`)
      setFile(null)
      setInputKey((k) => k + 1)
    })
  }

  const people = file ? file.data.rows.reduce((n, r) => n + r.people.length, 0) : 0

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Parent List</h2>
        <p className="text-sm ef-muted mt-1 max-w-3xl">
          Each student&apos;s father, mother and/or guardian. The name on the ID a parent verifies with is compared with this
          list on your queue and at the Program Head&apos;s first approval. It is a warning only — students can always
          submit, and you decide.
        </p>
      </div>

      {migrationMissing && (
        <div role="alert" className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--status-danger)', color: 'var(--status-danger)' }}>
          Run <code>supabase/migration_parent_list.sql</code> in the Supabase SQL editor first.
        </div>
      )}

      {/* The list (what the Registrar looks things up in) on the left, the
          upload (done once a term) on the right. Full width, like School Data. */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="ef-card rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b ef-border">
            <SearchInput value={query} onChange={setQuery} placeholder="Search student number, student or parent name…" label="Search the parent list" />
            <span className="shrink-0 text-xs ef-muted tabular-nums">{visible.length} of {students.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b ef-border text-left text-xs font-semibold ef-muted">
                  <th className="px-4 py-3">Student no.</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Parents and guardians</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map((s) => (
                  <tr key={s.studentNumber} className="align-top">
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--card-foreground)' }}>{s.studentNumber}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--card-foreground)' }}>{s.studentName || '—'}</td>
                    <td className="px-4 py-2.5 ef-muted">
                      {s.people.map((p) => (
                        <div key={`${p.relationship}|${p.name}`}>
                          <span className="text-xs">{p.relationship}:</span> <span style={{ color: 'var(--card-foreground)' }}>{p.name}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center ef-muted">{students.length ? 'No student matches your search.' : 'No list uploaded yet.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <section className={`${card} lg:sticky lg:top-20`}>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Upload the list</h3>
            <p className="text-xs ef-muted mt-1">
              One row per student. Father, Mother and Guardian can each be empty, but every student needs at least one.
              For a grandmother, aunt or anyone else, use Guardian and write who they are in Guardian Relationship. The
              upload replaces the whole list.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium ef-muted mb-1.5">Columns</p>
            <ul className="text-xs space-y-0.5" style={{ color: 'var(--card-foreground)' }}>
              {PARENT_LIST_COLUMNS.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
          {/* The whole area is the file picker, like School Data. */}
          <label
            className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed ef-border px-4 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-[var(--sti-gold)] ${isPending || migrationMissing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'}`}
          >
            <Icon name="upload" className="w-6 h-6" style={{ color: 'var(--sti-gold)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--card-foreground)' }}>
              {file ? file.name : 'Choose the Excel file'}
            </span>
            <span className="text-xs ef-muted">{file ? 'Click to choose a different file' : '.xlsx only'}</span>
            <input
              key={inputKey}
              type="file"
              accept=".xlsx"
              onChange={handleFile}
              disabled={isPending || migrationMissing}
              aria-label="Choose the parent list Excel file"
              className="sr-only"
            />
          </label>
          {fileError && <p role="alert" className="text-xs" style={{ color: 'var(--status-danger)' }}>{fileError}</p>}

          {file && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--card-foreground)' }}>
                {file.data.rows.length} students, {people} parents and guardians
              </p>
              <Issues title="must be fixed in the file" issues={file.data.errors} tone="var(--status-danger)" open />
              <Issues title="worth checking" issues={file.data.warnings} tone="var(--status-warning)" />
              {!file.data.errors.length && (
                <>
                  <p className="text-xs ef-muted">Nothing is saved yet. This replaces the {students.length} students on the current list.</p>
                  <button
                    type="button"
                    onClick={save}
                    disabled={isPending}
                    className="ef-press w-full px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                    style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                  >
                    {isPending ? 'Saving…' : 'Replace the list'}
                  </button>
                </>
              )}
            </div>
          )}
          {saveError && <p role="alert" className="text-sm" style={{ color: 'var(--status-danger)' }}>{saveError}</p>}
          {saved && <p className="text-sm font-semibold" style={{ color: 'var(--status-success)' }}>{saved}</p>}
        </section>
      </div>
    </div>
  )
}

function Issues({ title, issues, tone, open = false }: { title: string; issues: ParentListIssue[]; tone: string; open?: boolean }) {
  if (!issues.length) return null
  return (
    <details open={open}>
      <summary className="text-sm font-medium cursor-pointer" style={{ color: tone }}>
        {issues.length} {issues.length === 1 ? 'thing' : 'things'} {title}
      </summary>
      <ul className="mt-2 space-y-1 text-xs ef-muted list-disc pl-5 max-h-64 overflow-y-auto">
        {issues.map((i, n) => <li key={n}>{i.row ? <strong style={{ color: 'var(--card-foreground)' }}>Row {i.row}: </strong> : null}{i.message}</li>)}
      </ul>
    </details>
  )
}
