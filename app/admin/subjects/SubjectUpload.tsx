'use client'

import { useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import type { Subject, Department, Profile } from '@/lib/supabase/types'
import { validateRows, importSubjects, type ParsedRow } from './actions'

const MAX_FILE_SIZE = 5 * 1024 * 1024

export default function SubjectUpload({
  subjects,
  departments,
  teachers,
}: {
  subjects: (Subject & { departments: Department | null; profiles: Profile | null })[]
  departments: Department[]
  teachers: Profile[]
}) {
  const [preview, setPreview] = useState<ParsedRow[] | null>(null)
  const [mode, setMode] = useState<'replace' | 'upsert'>('upsert')
  const [result, setResult] = useState<{ added: number; updated: number; skipped: number } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    setPreview(null)
    setResult(null)

    if (!file.name.endsWith('.xlsx')) {
      setFileError('Only .xlsx files are accepted.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File exceeds 5 MB limit.')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        const headers = (raw[0] as string[]).map((h) => String(h).trim().toLowerCase())
        const requiredCols = ['subject code', 'subject name']
        const missing = requiredCols.filter((c) => !headers.includes(c))
        if (missing.length) {
          setFileError(`Missing required columns: ${missing.join(', ')}`)
          return
        }

        const colIdx = (name: string) => headers.indexOf(name)
        const rows: ParsedRow[] = raw.slice(1).map((r: unknown[]) => ({
          subject_code: String(r[colIdx('subject code')] ?? '').trim(),
          subject_name: String(r[colIdx('subject name')] ?? '').trim(),
          department_name: String(r[colIdx('department')] ?? '').trim(),
          teacher_email: String(r[colIdx('assigned teacher')] ?? '').trim(),
        })).filter((r) => r.subject_code || r.subject_name)

        startTransition(async () => {
          const validated = await validateRows(rows)
          setPreview(validated)
        })
      } catch {
        setFileError('Failed to parse file. Make sure it is a valid .xlsx file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleImport() {
    if (!preview) return
    startTransition(async () => {
      const res = await importSubjects(preview, mode)
      if (res.error) {
        setFileError(res.error)
      } else {
        setResult({ added: res.added, updated: res.updated, skipped: res.skipped })
        setPreview(null)
      }
    })
  }

  const hasErrors = preview?.some((r) => r.error)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Subjects &amp; Teacher Assignment</h2>

      {/* Upload zone */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-semibold text-gray-700 mb-1">Upload Semester Excel</h3>
        <p className="text-xs text-gray-500 mb-4">
          Expected columns (case-insensitive): <code>Subject Code</code>, <code>Subject Name</code>, <code>Department</code>, <code>Assigned Teacher</code> (email)
        </p>

        <input
          type="file"
          accept=".xlsx"
          onChange={handleFile}
          className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:cursor-pointer"
          style={{ '--file-bg': 'var(--sti-gold)', '--file-color': 'var(--sti-navy)' } as React.CSSProperties}
        />

        {fileError && (
          <p className="mt-2 text-sm text-red-600">{fileError}</p>
        )}

        {isPending && (
          <p className="mt-2 text-sm text-gray-400">Processing…</p>
        )}

        {result && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Import complete — Added: {result.added}, Updated: {result.updated}, Skipped: {result.skipped}
          </div>
        )}
      </div>

      {/* Preview table */}
      {preview && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Preview ({preview.length} rows)</h3>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" name="mode" value="upsert" checked={mode === 'upsert'} onChange={() => setMode('upsert')} />
                Add / Update
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" name="mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                Replace All
              </label>
              <button
                onClick={handleImport}
                disabled={isPending || !!hasErrors}
                title={hasErrors ? 'Fix errors before importing' : ''}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
              >
                {isPending ? 'Importing…' : 'Confirm Import'}
              </button>
            </div>
          </div>

          {hasErrors && (
            <p className="mb-3 text-sm text-red-600">Rows with errors are highlighted. Fix the file and re-upload.</p>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b text-left text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Teacher</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.map((r, i) => (
                  <tr key={i} className={r.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 font-mono">{r.subject_code}</td>
                    <td className="px-3 py-2">{r.subject_name}</td>
                    <td className="px-3 py-2">{r.department_name || '—'}</td>
                    <td className="px-3 py-2">{r.teacher_email || '—'}</td>
                    <td className="px-3 py-2">
                      {r.error
                        ? <span className="text-red-600">{r.error}</span>
                        : <span className="text-green-600">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Current subjects */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-700">Current Subjects ({subjects.length})</h3>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Subject Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Teacher</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subjects.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{s.subject_code}</td>
                <td className="px-4 py-3">{s.subject_name}</td>
                <td className="px-4 py-3 text-gray-500">{s.departments?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{s.profiles?.full_name ?? '—'}</td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No subjects yet. Upload an Excel file to populate.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
