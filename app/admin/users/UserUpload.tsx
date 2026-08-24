'use client'

import { useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { validateUserRows, importUserChunk, type ParsedUserRow } from './actions'
import { IMPORT_CHUNK_SIZE } from './constants'

const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * Bulk account creation from the registrar's enrolment Excel.
 *
 * Flow: pick .xlsx → parse in the browser (SheetJS) → server validates every
 * row → admin reviews a preview → confirm writes them.
 *
 * Creating an auth user is one API call each and can't be batched, so a
 * thousand rows in a single request would exceed the serverless time limit.
 * The import is therefore sent in sequential chunks, which also gives an honest
 * progress bar instead of a spinner that looks frozen for two minutes.
 */
export default function UserUpload() {
  const [preview, setPreview] = useState<ParsedUserRow[] | null>(null)
  const [defaultPassword, setDefaultPassword] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ created: number; failures: { email: string; reason: string }[] } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null); setPreview(null); setResult(null); setProgress(null)

    if (!file.name.endsWith('.xlsx')) return setFileError('Only .xlsx files are accepted.')
    if (file.size > MAX_FILE_SIZE) return setFileError('File exceeds 5 MB limit.')

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (!raw.length) return setFileError('The file is empty.')

        // Matched by header NAME, case-insensitively — the school's column
        // order doesn't have to match ours.
        const headers = (raw[0] as string[]).map((h) => String(h).trim().toLowerCase())
        const missing = ['full name', 'email', 'role'].filter((c) => !headers.includes(c))
        if (missing.length) {
          return setFileError(`Missing required columns: ${missing.join(', ')}`)
        }

        const at = (r: unknown[], name: string) => {
          const i = headers.indexOf(name)
          return i === -1 ? '' : String(r[i] ?? '').trim()
        }
        const rows: ParsedUserRow[] = raw.slice(1).map((r: unknown[]) => ({
          full_name: at(r, 'full name'),
          email: at(r, 'email'),
          role: at(r, 'role'),
          student_number: at(r, 'student number'),
          course: at(r, 'course'),
          year_level: at(r, 'year level'),
          section: at(r, 'section'),
          department_name: at(r, 'department'),
          password: at(r, 'password'),
        })).filter((r) => r.full_name || r.email)

        if (!rows.length) return setFileError('No data rows found below the header.')

        startTransition(async () => setPreview(await validateUserRows(rows)))
      } catch {
        setFileError('Failed to read the file. Make sure it is a valid .xlsx.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleImport() {
    if (!preview) return
    const good = preview.filter((r) => !r.error)
    if (!good.length) return setFileError('There are no valid rows to import.')

    startTransition(async () => {
      let created = 0
      const failures: { email: string; reason: string }[] = []
      setProgress({ done: 0, total: good.length })

      for (let i = 0; i < good.length; i += IMPORT_CHUNK_SIZE) {
        const chunk = good.slice(i, i + IMPORT_CHUNK_SIZE)
        const res = await importUserChunk(chunk, defaultPassword)
        if (res.error) {
          // A whole-chunk failure (misconfiguration, session lost) — stop rather
          // than hammer the server with the remaining chunks.
          setFileError(res.error)
          break
        }
        created += res.created
        failures.push(...res.failures)
        setProgress({ done: Math.min(i + IMPORT_CHUNK_SIZE, good.length), total: good.length })
      }

      setResult({ created, failures })
      setPreview(null)
      setProgress(null)
    })
  }

  const errorCount = preview?.filter((r) => r.error).length ?? 0
  const okCount = (preview?.length ?? 0) - errorCount
  const needsPassword = preview?.some((r) => !r.error && !r.password) ?? false
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Bulk Import Accounts</h3>
        <p className="text-2xs sm:text-xs ef-muted mt-1">
          Upload the enrolment list to create many accounts at once. Required columns:{' '}
          <code>Full Name</code>, <code>Email</code>, <code>Role</code>. Optional:{' '}
          <code>Student Number</code>, <code>Course</code>, <code>Year Level</code>,{' '}
          <code>Section</code>, <code>Department</code>, <code>Password</code>.
        </p>
        <p className="text-2xs ef-muted mt-1">
          Roles: <code>student</code>, <code>subject_teacher</code>, <code>registrar</code>,{' '}
          <code>program_head</code>, <code>admin</code>. Department is matched by name and must already exist.
        </p>
      </div>

      <input
        type="file"
        accept=".xlsx"
        onChange={handleFile}
        aria-label="Choose an Excel file of accounts"
        className="block w-full text-sm ef-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:cursor-pointer file:bg-[var(--sti-gold)] file:text-[var(--sti-navy)]"
      />

      {fileError && (
        <p role="alert" className="text-xs flex items-start gap-1.5" style={{ color: 'var(--status-danger)' }}>
          <span aria-hidden="true">⚠</span><span>{fileError}</span>
        </p>
      )}

      {/* Progress — a long import must never look frozen. */}
      {progress && (
        <div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div className="h-full transition-[width] duration-300 ease-[var(--ease-out)]"
              style={{ width: `${pct}%`, background: 'var(--sti-gold)' }} />
          </div>
          <p className="text-2xs ef-muted mt-1.5">Creating accounts… {progress.done} of {progress.total}</p>
        </div>
      )}

      {result && (
        <div className="rounded-lg border ef-border p-4 space-y-2">
          <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--status-success)' }}>
            <span aria-hidden="true">✓</span> {result.created} account{result.created === 1 ? '' : 's'} created
          </p>
          {result.failures.length > 0 && (
            <details>
              <summary className="text-xs cursor-pointer" style={{ color: 'var(--status-danger)' }}>
                {result.failures.length} row{result.failures.length === 1 ? '' : 's'} skipped — show details
              </summary>
              <ul className="mt-2 space-y-1 text-2xs ef-muted max-h-48 overflow-y-auto">
                {result.failures.map((f, i) => (
                  <li key={i}><span className="font-mono">{f.email || '(no email)'}</span> — {f.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm" style={{ color: 'var(--card-foreground)' }}>
              <strong>{okCount}</strong> ready
              {errorCount > 0 && <> · <span style={{ color: 'var(--status-danger)' }}><strong>{errorCount}</strong> with problems</span></>}
            </p>
            <button
              type="button"
              onClick={handleImport}
              disabled={isPending || okCount === 0 || (needsPassword && defaultPassword.length < 6)}
              className="ef-press ml-auto px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              {isPending ? 'Importing…' : `Create ${okCount} account${okCount === 1 ? '' : 's'}`}
            </button>
          </div>

          {/* Only asked for when some row actually lacks its own password. */}
          {needsPassword && (
            <div>
              <label htmlFor="default-pw" className="block text-xs font-medium mb-1" style={{ color: 'var(--card-foreground)' }}>
                Temporary password for rows without a Password column
              </label>
              <input
                id="default-pw"
                type="text"
                value={defaultPassword}
                onChange={(e) => setDefaultPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full sm:w-72 rounded-lg px-3 py-2 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]"
              />
              <p className="text-2xs mt-1" style={{ color: 'var(--status-warning)' }}>
                Everyone without their own password will share this one. Add a{' '}
                <code>Password</code> column to give each person a unique one.
              </p>
            </div>
          )}

          {errorCount > 0 && (
            <p className="text-2xs ef-muted">
              Rows with problems are skipped — the valid ones still import. Fix the file and upload again to add the rest.
            </p>
          )}

          <div className="overflow-x-auto border ef-border rounded-lg">
            <table className="min-w-full text-2xs">
              <thead>
                <tr className="border-b ef-border text-left ef-muted uppercase tracking-wide">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {preview.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{r.full_name || '—'}</td>
                    <td className="px-3 py-2 font-mono">{r.email || '—'}</td>
                    <td className="px-3 py-2">{r.role || '—'}</td>
                    <td className="px-3 py-2">
                      {r.error
                        ? <span style={{ color: 'var(--status-danger)' }}>⚠ {r.error}</span>
                        : <span style={{ color: 'var(--status-success)' }}>✓ Ready</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
