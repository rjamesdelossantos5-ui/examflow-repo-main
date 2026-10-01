'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export interface SubjectRow {
  id: string
  code: string
  name: string
  department: string | null
  classes: number
}

/**
 * Read-only view of the subjects. They come from the School Data import
 * (/admin/school-data), once per code + department; editing happens in the
 * file, not here.
 */
export default function SubjectList({ subjects }: { subjects: SubjectRow[] }) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? subjects.filter((s) => [s.code, s.name, s.department ?? ''].some((v) => v.toLowerCase().includes(q))) : subjects
  }, [subjects, query])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Subjects</h2>
        <p className="text-sm ef-muted mt-1">
          Imported from the <Link href="/admin/school-data" className="underline underline-offset-2">School Data</Link> file. To change a subject, edit the file and import it again.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search code, name or department…"
          aria-label="Search subjects"
          className="flex-1 min-w-[14rem] rounded-lg px-3 py-2 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]"
          style={{ color: 'var(--card-foreground)' }}
        />
        <span className="text-xs ef-muted tabular-nums">{visible.length} of {subjects.length}</span>
      </div>

      <div className="ef-card rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b ef-border text-left text-xs font-semibold uppercase tracking-wide ef-muted">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3 text-right">Classes</th>
            </tr>
          </thead>
          <tbody className="divide-y ef-border">
            {visible.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--card-foreground)' }}>{s.code}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--card-foreground)' }}>{s.name}</td>
                <td className="px-4 py-2.5 ef-muted">{s.department ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums ef-muted">{s.classes}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center ef-muted">{subjects.length ? 'No subject matches your search.' : 'No subjects yet — import the School Data file.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
