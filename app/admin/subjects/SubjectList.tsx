'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Select from '@/components/Select'
import SearchInput from '@/components/SearchInput'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { updateSubject } from './actions'

export interface SubjectRow {
  id: string
  code: string
  name: string
  department: string | null
  /** Each section the subject is taught in, and by whom. */
  classes: { id: string; section: string; teacherId: string | null }[]
}

export interface TeacherOption {
  id: string
  name: string
  department: string | null
}

const fieldClass = 'w-full rounded-lg px-3 py-2 text-sm border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]'
const fieldStyle = { backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }

/**
 * The subjects from the School Data import. Clicking one shows its sections and
 * who teaches each; Edit changes its code, name and the teacher per section.
 */
export default function SubjectList({ subjects, teachers }: { subjects: SubjectRow[]; teachers: TeacherOption[] }) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? subjects.filter((s) => [s.code, s.name, s.department ?? ''].some((v) => v.toLowerCase().includes(q))) : subjects
  }, [subjects, query])

  const teacherName = useMemo(() => new Map(teachers.map((t) => [t.id, t.name])), [teachers])
  const teacherOptions = useMemo(
    () => [{ value: '', label: '— No teacher —' }, ...teachers.map((t) => ({ value: t.id, label: t.department ? `${t.name} · ${t.department}` : t.name }))],
    [teachers],
  )

  // The open subject (null = closed), and whether it is being edited.
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const open = subjects.find((s) => s.id === openId) ?? null

  const close = useCallback(() => { setOpenId(null); setEditing(false); setError(null) }, [])
  useEscapeKey(close, !!openId && !isPending)

  function show(s: SubjectRow, edit: boolean) {
    setOpenId(s.id)
    setError(null)
    setCode(s.code)
    setName(s.name)
    setPicked(Object.fromEntries(s.classes.map((c) => [c.id, c.teacherId ?? ''])))
    setEditing(edit)
  }

  function save() {
    if (!open) return
    const subjectId = open.id
    startTransition(async () => {
      const res = await updateSubject({ subjectId, code, name, teachers: picked })
      if (res.error) setError(res.error)
      else { setEditing(false); setError(null) }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Subjects</h2>
        <p className="text-sm ef-muted mt-1">
          Imported from the <Link href="/admin/school-data" className="underline underline-offset-2">School Data</Link> file.
          Click a subject to see its sections and teachers.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search code, name or department…" label="Search subjects" />
        <span className="text-xs ef-muted tabular-nums">{visible.length} of {subjects.length}</span>
      </div>

      <div className="ef-card rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b ef-border text-left text-xs font-semibold uppercase tracking-wide ef-muted">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3 text-right">Sections</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y ef-border">
            {visible.map((s) => (
              <tr
                key={s.id}
                onClick={() => show(s, false)}
                className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--card-foreground)' }}>{s.code}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--card-foreground)' }}>
                  {/* A real button too, so keyboard users can open it. */}
                  <button type="button" onClick={(e) => { e.stopPropagation(); show(s, false) }} className="text-left hover:underline underline-offset-2">
                    {s.name}
                  </button>
                </td>
                <td className="px-4 py-2.5 ef-muted">{s.department ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums ef-muted">{s.classes.length}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); show(s, true) }}
                    className="text-xs px-2 py-1 border ef-border rounded hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: 'var(--card-foreground)' }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center ef-muted">{subjects.length ? 'No subject matches your search.' : 'No subjects yet — import the School Data file.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="ef-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={isPending ? undefined : close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-title"
            className="ef-dialog ef-card rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {editing ? (
              <>
                <h3 id="subject-title" className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>Edit subject</h3>
                <p className="text-xs ef-muted">{open.department ?? 'No department'}</p>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <label className="text-xs ef-muted space-y-1">
                    <span>Code</span>
                    <input value={code} onChange={(e) => setCode(e.target.value)} className={`${fieldClass} font-mono`} style={fieldStyle} />
                  </label>
                  <label className="col-span-2 text-xs ef-muted space-y-1">
                    <span>Subject name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} style={fieldStyle} />
                  </label>
                </div>
              </>
            ) : (
              <>
                <h3 id="subject-title" className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>
                  <span className="font-mono text-base">{open.code}</span> {open.name}
                </h3>
                <p className="text-xs ef-muted">{open.department ?? 'No department'}</p>
              </>
            )}

            <p className="text-sm mt-4 mb-2" style={{ color: 'var(--card-foreground)' }}>
              Taught in <strong>{open.classes.length}</strong> section{open.classes.length === 1 ? '' : 's'}
            </p>
            <div className="overflow-y-auto rounded-lg border ef-border min-h-0">
              {open.classes.length ? (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b ef-border text-left text-xs font-semibold uppercase tracking-wide ef-muted">
                      <th className="px-3 py-2">Section</th>
                      <th className="px-3 py-2">Teacher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y ef-border">
                    {open.classes.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 whitespace-nowrap align-middle" style={{ color: 'var(--card-foreground)' }}>{c.section}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--card-foreground)' }}>
                          {editing ? (
                            <Select
                              value={picked[c.id] ?? ''}
                              onChange={(v) => setPicked((p) => ({ ...p, [c.id]: v }))}
                              options={teacherOptions}
                              placeholder="— No teacher —"
                              className="w-full rounded-lg px-3 py-1.5 text-sm border ef-border"
                              style={fieldStyle}
                            />
                          ) : c.teacherId ? (
                            teacherName.get(c.teacherId) ?? 'Unknown teacher'
                          ) : (
                            <span className="ef-muted">No teacher</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-3 py-6 text-center text-sm ef-muted">Not taught in any section yet.</p>
              )}
            </div>

            {editing && (
              <p className="text-xs ef-muted mt-3">
                Requests already sent keep their teacher. The next School Data import sets this subject and its sections from the file again.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 rounded-md px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">{error}</p>
            )}

            <div className="flex justify-end gap-2 mt-4">
              {editing ? (
                <>
                  <button type="button" onClick={() => show(open, false)} disabled={isPending}
                    className="px-4 py-2 text-sm rounded-lg font-semibold border ef-border disabled:opacity-50" style={{ color: 'var(--card-foreground)' }}>
                    Cancel
                  </button>
                  <button type="button" onClick={save} disabled={isPending}
                    className="px-4 py-2 text-sm rounded-lg font-semibold disabled:opacity-50"
                    style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
                    {isPending ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={close} autoFocus
                    className="px-4 py-2 text-sm rounded-lg font-semibold border ef-border" style={{ color: 'var(--card-foreground)' }}>
                    Close
                  </button>
                  <button type="button" onClick={() => show(open, true)}
                    className="px-4 py-2 text-sm rounded-lg font-semibold"
                    style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
