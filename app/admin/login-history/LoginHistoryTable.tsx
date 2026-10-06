'use client'

import { useMemo, useState } from 'react'
import SearchInput from '@/components/SearchInput'
import Select from '@/components/Select'

export interface LoginRow {
  id: string
  name: string
  email: string
  role: string
  method: string
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

const METHOD_LABELS: Record<string, string> = {
  microsoft: 'Microsoft',
  password: 'Email & password',
}

/** The sign-ins, searchable by name or email and filterable by role. */
export default function LoginHistoryTable({ rows, capped }: { rows: LoginRow[]; capped: boolean }) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) =>
      (!role || r.role === role) &&
      (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)),
    )
  }, [rows, query, role])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name or email…" label="Search login history" />
        <Select
          value={role}
          onChange={setRole}
          options={[{ value: '', label: 'All roles' }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]}
          className="w-44 rounded-lg px-3 py-2 text-sm border ef-border"
          style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
        />
        <span className="text-xs ef-muted tabular-nums">{visible.length} of {rows.length} sign-ins</span>
      </div>
      {capped && <p className="text-xs ef-muted">Showing the most recent {rows.length} sign-ins.</p>}

      <div className="ef-card rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b ef-border text-left text-xs font-semibold uppercase tracking-wide ef-muted">
              <th className="px-4 py-3">Date &amp; time</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Signed in with</th>
            </tr>
          </thead>
          <tbody className="divide-y ef-border">
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums" style={{ color: 'var(--card-foreground)' }}>{r.when}</td>
                <td className="px-4 py-2.5">
                  <div style={{ color: 'var(--card-foreground)' }}>{r.name}</div>
                  <div className="text-xs ef-muted break-all">{r.email}</div>
                </td>
                <td className="px-4 py-2.5 ef-muted whitespace-nowrap">{ROLE_LABELS[r.role] ?? r.role}</td>
                <td className="px-4 py-2.5 ef-muted whitespace-nowrap">{METHOD_LABELS[r.method] ?? r.method}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center ef-muted">{rows.length ? 'No sign-in matches your search.' : 'No sign-ins recorded yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
