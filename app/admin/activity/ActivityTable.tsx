'use client'

import { useMemo, useState } from 'react'
import SearchInput from '@/components/SearchInput'
import Select from '@/components/Select'
import Pagination, { usePagination } from '@/components/Pagination'

export interface ActivityRow {
  id: string
  name: string
  email: string
  role: string
  action: string
  notes: string | null
  /** Subject code of the request acted on. */
  subject: string | null
  /** The student the request belongs to. */
  student: string | null
  /** Already formatted in Manila time by the page. */
  when: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  registrar: 'Registrar',
  program_head: 'Program Head',
  subject_teacher: 'Subject Teacher',
  student: 'Student',
}

/** The activity log, searchable (name, email, action, subject, student) and filterable by role. */
export default function ActivityTable({ rows, capped }: { rows: ActivityRow[]; capped: boolean }) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) =>
      (!role || r.role === role) &&
      (!q || [r.name, r.email, r.action, r.subject, r.student].some((v) => v && v.toLowerCase().includes(q))),
    )
  }, [rows, query, role])
  const { items: pageRows, pagerProps } = usePagination(visible, `${query}|${role}`)
  // The rows that were on the page when it opened. Anything that arrives later
  // (the page reloads its data as new activity happens) is highlighted.
  const [openedWith] = useState(() => new Set(rows.map((r) => r.id)))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, action, subject…" label="Search user activity" />
        <Select
          value={role}
          onChange={setRole}
          options={[{ value: '', label: 'All roles' }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]}
          className="w-44 rounded-lg px-3 py-2 text-sm border ef-border"
          style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
        />
        <span className="text-xs ef-muted tabular-nums">{visible.length} of {rows.length} actions</span>
      </div>
      {capped && <p className="text-xs ef-muted">Showing the most recent {rows.length} actions.</p>}

      <div className="ef-card rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b ef-border text-left text-xs font-semibold uppercase tracking-wide ef-muted">
              <th className="px-4 py-3">Date &amp; time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Request</th>
            </tr>
          </thead>
          <tbody className="divide-y ef-border">
            {pageRows.map((r) => (
              <tr
                key={r.id}
                className="align-top"
                style={openedWith.has(r.id) ? undefined : { background: 'color-mix(in srgb, var(--sti-gold) 14%, transparent)' }}
              >
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums" style={{ color: 'var(--card-foreground)' }}>{r.when}</td>
                <td className="px-4 py-2.5">
                  <div style={{ color: 'var(--card-foreground)' }}>{r.name}</div>
                  {r.email && <div className="text-xs ef-muted break-all">{r.email}</div>}
                </td>
                <td className="px-4 py-2.5 ef-muted whitespace-nowrap">{ROLE_LABELS[r.role] ?? r.role}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--card-foreground)' }}>
                  {r.action}
                  {r.notes && <div className="text-xs ef-muted">{r.notes}</div>}
                </td>
                <td className="px-4 py-2.5 ef-muted">
                  {r.subject ?? '—'}
                  {r.student && <div className="text-xs">{r.student}</div>}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center ef-muted">{rows.length ? 'No activity matches your search.' : 'No activity recorded yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...pagerProps} />
    </div>
  )
}
