'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import Select from '@/components/Select'
import { readScheduleSheet, buildSchedule, suggestTeacher, type ParsedSchedule, type SheetSummary } from '@/lib/scheduleImport'
import { importSchedule } from './actions'

const MAX_FILE_SIZE = 5 * 1024 * 1024

interface Props {
  departments: { id: string; name: string }[]
  teachers: { id: string; full_name: string; email: string }[]
  savedTeachers: Record<string, string>
  savedPrograms: Record<string, string>
  current: { classes: number; sections: number; withoutTeacher: number }
  migrationMissing: boolean
}

type Source = 'saved' | 'suggested' | 'none'

/**
 * Each term: upload the registrar's class schedule → review → import.
 * The file is read in the browser (lib/scheduleImport.ts); nothing is saved
 * until "Replace class schedule". Program → department and instructor →
 * teacher choices are remembered, so next term only new names need matching.
 */
export default function ScheduleImport({ departments, teachers, savedTeachers, savedPrograms, current, migrationMissing }: Props) {
  const [parsed, setParsed] = useState<ParsedSchedule | null>(null)
  const [sheets, setSheets] = useState<SheetSummary[]>([])
  const [programs, setPrograms] = useState<Record<string, string>>({})
  const [matches, setMatches] = useState<Record<string, string>>({})
  const [sources, setSources] = useState<Record<string, Source>>({})
  const [fileError, setFileError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ classes: number; subjects: number; unassigned: number } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    setParsed(null)
    setResult(null)
    setConfirming(false)
    if (!file.name.toLowerCase().endsWith('.xlsx')) return setFileError('Only .xlsx files are accepted.')
    if (file.size > MAX_FILE_SIZE) return setFileError('File exceeds the 5 MB limit.')

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const read = wb.SheetNames.map((name) =>
          readScheduleSheet(name, XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as unknown[][]),
        )
        const schedule = buildSchedule(read.flatMap((r) => r.rows))
        if (!schedule.offerings.length) {
          setSheets(read.map((r) => r.summary))
          return setFileError('No class schedule found. Each sheet needs SECTION, COURSE CODE and INSTRUCTOR columns.')
        }

        const nextPrograms: Record<string, string> = {}
        for (const p of schedule.programs) if (savedPrograms[p]) nextPrograms[p] = savedPrograms[p]
        const nextMatches: Record<string, string> = {}
        const nextSources: Record<string, Source> = {}
        for (const { alias } of schedule.instructors) {
          const saved = savedTeachers[alias]
          const suggested = saved ? null : suggestTeacher(alias, teachers)
          nextMatches[alias] = saved ?? suggested ?? ''
          nextSources[alias] = saved ? 'saved' : suggested ? 'suggested' : 'none'
        }
        setSheets(read.map((r) => r.summary))
        setPrograms(nextPrograms)
        setMatches(nextMatches)
        setSources(nextSources)
        setParsed(schedule)
      } catch {
        setFileError('Could not read this file. Make sure it is a valid .xlsx file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const stats = useMemo(() => {
    if (!parsed) return null
    const unmatched = parsed.instructors.filter((i) => !matches[i.alias])
    return {
      sections: new Set(parsed.offerings.map((o) => o.section)).size,
      subjects: Object.keys(parsed.subjectNames).length,
      missingPrograms: parsed.programs.filter((p) => !programs[p]),
      unmatched,
      unmatchedClasses: unmatched.reduce((n, i) => n + i.classes, 0),
    }
  }, [parsed, programs, matches])

  function handleImport() {
    if (!parsed) return
    startTransition(async () => {
      const res = await importSchedule({
        programs,
        teachers: Object.fromEntries(parsed.instructors.map((i) => [i.alias, matches[i.alias] || null])),
        subjectNames: parsed.subjectNames,
        offerings: parsed.offerings.map(({ section, program, yearLevel, code, instructor }) => ({ section, program, yearLevel, code, instructor })),
      })
      setConfirming(false)
      if (res.error) return setFileError(res.error)
      setResult({ classes: res.classes ?? 0, subjects: res.subjects ?? 0, unassigned: res.unassigned ?? 0 })
      setParsed(null)
    })
  }

  const teacherOptions = [{ value: '', label: 'Not assigned yet' }, ...teachers.map((t) => ({ value: t.id, label: `${t.full_name} — ${t.email}` }))]
  const departmentOptions = departments.map((d) => ({ value: d.id, label: d.name }))
  const selectClass = 'w-full rounded-lg px-3 py-2 text-sm border ef-border'
  const selectStyle = { backgroundColor: 'var(--card)', color: 'var(--card-foreground)' } as React.CSSProperties
  const blocked = !stats || stats.missingPrograms.length > 0

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Class Schedule</h2>
        <p className="text-sm ef-muted mt-1">
          Once a term, upload the registrar&apos;s class schedule. It tells EXAMFLOW which teacher handles each
          section&apos;s subject, so a student&apos;s request goes to the right teacher.
        </p>
      </div>

      {migrationMissing && (
        <div role="alert" className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--status-danger)', color: 'var(--status-danger)' }}>
          The database is missing this feature&apos;s tables. Run <code>supabase/migration_class_schedule.sql</code> in the Supabase SQL editor first.
        </div>
      )}

      <div className="ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            ['Classes now', current.classes],
            ['Sections', current.sections],
            ['Without a teacher', current.withoutTeacher],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-lg border ef-border px-3 py-3">
              <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--card-foreground)' }}>{n}</p>
              <p className="text-2xs ef-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Upload the class schedule</h3>
          <p className="text-2xs sm:text-xs ef-muted mt-1">
            The registrar&apos;s Excel as it is — every sheet with <code>SECTION</code>, <code>COURSE CODE</code> and{' '}
            <code>INSTRUCTOR</code> columns is read; LAB and LEC rows become one subject. Nothing is saved until you confirm.
          </p>
        </div>
        <input
          type="file"
          accept=".xlsx"
          onChange={handleFile}
          aria-label="Choose the class schedule Excel file"
          className="block w-full text-sm ef-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:cursor-pointer file:bg-[var(--sti-gold)] file:text-[var(--sti-navy)]"
        />
        {fileError && <p role="alert" className="text-xs" style={{ color: 'var(--status-danger)' }}>{fileError}</p>}
        {result && (
          <div className="rounded-lg border ef-border p-4 text-sm" style={{ color: 'var(--status-success)' }}>
            <p className="font-semibold">Schedule imported: {result.classes} classes across {result.subjects} subject entries.</p>
            {result.unassigned > 0 && (
              <p className="mt-1 text-xs" style={{ color: 'var(--card-foreground)' }}>
                {result.unassigned} class{result.unassigned === 1 ? ' has' : 'es have'} no teacher yet — students can still pick them,
                but no teacher will receive those requests until you match the instructor and import again.
              </p>
            )}
          </div>
        )}
        {sheets.length > 0 && (
          <ul className="text-xs space-y-1">
            {sheets.map((s) => (
              <li key={s.name} className="flex flex-wrap gap-x-2">
                <span className="font-medium" style={{ color: s.usable ? 'var(--status-success)' : 'var(--muted)' }}>
                  {s.usable ? 'Read' : 'Skipped'}
                </span>
                <span style={{ color: 'var(--card-foreground)' }}>{s.name}</span>
                <span className="ef-muted">
                  {s.usable ? `${s.classRows} class rows, ${s.sections} sections` : s.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {parsed && stats && (
        <>
          <div className="ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>
              {parsed.offerings.length} classes · {stats.sections} sections · {stats.subjects} subjects · {parsed.instructors.length} instructors
            </h3>
            {parsed.issues.length > 0 ? (
              <details>
                <summary className="text-sm cursor-pointer" style={{ color: 'var(--status-warning)' }}>
                  {parsed.issues.length} thing{parsed.issues.length === 1 ? '' : 's'} in the file to check — show
                </summary>
                <ul className="mt-2 space-y-1.5 text-xs ef-muted list-disc pl-5">
                  {parsed.issues.map((i, n) => <li key={n}>{i.message}</li>)}
                </ul>
              </details>
            ) : (
              <p className="text-sm" style={{ color: 'var(--status-success)' }}>No problems found in the file.</p>
            )}
          </div>

          <div className="ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>1 · Which department does each program belong to?</h3>
              <p className="text-2xs sm:text-xs ef-muted mt-1">
                Decides which Program Head reviews a student&apos;s request. Remembered for next term.{' '}
                <Link href="/admin/departments" className="underline underline-offset-2">Add a department</Link>
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {parsed.programs.map((p) => (
                <label key={p} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 font-mono text-sm font-semibold" style={{ color: 'var(--card-foreground)' }}>{p}</span>
                  <Select
                    value={programs[p] ?? ''}
                    onChange={(v) => setPrograms((prev) => ({ ...prev, [p]: v }))}
                    placeholder="— Choose department —"
                    options={departmentOptions}
                    className={selectClass}
                    style={selectStyle}
                  />
                </label>
              ))}
            </div>
            {stats.missingPrograms.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--status-danger)' }}>Still needed: {stats.missingPrograms.join(', ')}</p>
            )}
          </div>

          <div className="ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>2 · Match each instructor to a teacher account</h3>
              <p className="text-2xs sm:text-xs ef-muted mt-1">
                The schedule only has surnames. Matches are suggested where exactly one teacher fits, and remembered after
                import. A teacher who has no account yet can be added on{' '}
                <Link href="/admin/users" className="underline underline-offset-2">Users</Link> (role Subject Teacher) — then upload the file again.
              </p>
            </div>
            <ul className="divide-y ef-border max-h-[32rem] overflow-y-auto">
              {parsed.instructors.map(({ alias, classes }) => (
                <li key={alias} className="py-2.5 grid sm:grid-cols-[minmax(0,14rem)_1fr] gap-2 items-center">
                  <div>
                    <p className="font-mono text-sm font-semibold" style={{ color: 'var(--card-foreground)' }}>{alias}</p>
                    <p className="text-2xs ef-muted">
                      {classes} class{classes === 1 ? '' : 'es'}
                      {sources[alias] === 'saved' && ' · matched before'}
                      {sources[alias] === 'suggested' && ' · suggested — check it'}
                    </p>
                  </div>
                  <Select
                    value={matches[alias] ?? ''}
                    onChange={(v) => {
                      setMatches((prev) => ({ ...prev, [alias]: v }))
                      setSources((prev) => ({ ...prev, [alias]: 'none' }))
                    }}
                    options={teacherOptions}
                    className={selectClass}
                    style={selectStyle}
                  />
                </li>
              ))}
            </ul>
            <p className="text-xs" style={{ color: stats.unmatched.length ? 'var(--status-danger)' : 'var(--status-success)' }}>
              {stats.unmatched.length
                ? `${stats.unmatched.length} instructor${stats.unmatched.length === 1 ? '' : 's'} not matched (${stats.unmatchedClasses} classes). You can still import; those classes wait for a teacher.`
                : 'Every instructor is matched.'}
            </p>
          </div>

          <div className="ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>3 · Replace the class schedule</h3>
            <p className="text-xs ef-muted">
              The current {current.classes} classes are replaced by these {parsed.offerings.length}. Requests already submitted keep the teacher
              they were sent to.
            </p>
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={blocked || isPending || migrationMissing}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
              >
                Replace class schedule
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>Replace {current.classes} classes with {parsed.offerings.length}?</span>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={isPending}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                  style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                >
                  {isPending ? 'Importing…' : 'Yes, replace'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={isPending} className="px-3 py-2.5 rounded-lg text-sm ef-muted">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
