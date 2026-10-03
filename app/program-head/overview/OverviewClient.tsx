'use client'

import { useState } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import type { RequestStatus } from '@/lib/supabase/types'

export interface OverviewRow {
  id: string
  status: RequestStatus
  exam_type: string
  submitted_at: string
  name: string
  section: string | null
  subject_code: string
  subject_name: string
  rejected_by_role: string | null
  rejection_reason: string | null
}

// 'scheduled' is intentionally omitted — scheduled requests drop off the overview.
const STAGES: { status: RequestStatus; label: string }[] = [
  { status: 'submitted', label: 'Waiting for Registrar' },
  { status: 'verified_by_registrar', label: 'Waiting for Teacher' },
  { status: 'approved_by_teacher', label: 'Waiting for Program Head' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'receipt_uploaded', label: 'Receipt to verify' },
  { status: 'rejected', label: 'Rejected' },
]

const ROLE_LABEL: Record<string, string> = {
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  admin: 'Admin',
}

// Where each waiting form is acted on — the same page that role uses. ?req=
// opens that request's panel straight away (Registrar, Teacher and Program
// Head queues read it). The admin may open every step; a Program Head only
// their own two.
const OPEN: Partial<Record<RequestStatus, { href: (id: string) => string; label: string; admin: boolean }>> = {
  submitted: { href: (id) => `/registrar?req=${id}`, label: 'Open as Registrar', admin: true },
  verified_by_registrar: { href: (id) => `/teacher?req=${id}`, label: 'Open as Teacher', admin: true },
  approved_by_teacher: { href: (id) => `/program-head?req=${id}`, label: 'Open', admin: false },
  accepted: { href: () => '/registrar/assessment', label: 'Payment assessment', admin: true },
  receipt_uploaded: { href: (id) => `/program-head/receipts?req=${id}`, label: 'Open', admin: false },
}

/**
 * Every form and the step it is at. Program Heads see their department; the
 * admin (as /admin/requests, the same component) sees every department and can
 * open any waiting form on the page where that step is done.
 */
export default function OverviewClient({ rows, viewer }: { rows: OverviewRow[]; viewer: 'admin' | 'program_head' }) {
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all')

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  const openFor = (status: RequestStatus) => {
    const o = OPEN[status]
    return o && (viewer === 'admin' || !o.admin) ? o : null
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Requests Overview</h2>
        <p className="text-sm ef-muted">
          {viewer === 'admin'
            ? 'Every form in every department, at the step it is waiting on. Open one to act on it exactly as the Registrar, Teacher or Program Head would — it is recorded as done by Admin.'
            : 'Click a stage to filter.'}
        </p>
      </div>

      {/* Clickable stage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`ef-card rounded-xl shadow-sm p-3 text-left transition-shadow duration-200 ease-[var(--ease-out)] hover:shadow-md ${filter === 'all' ? 'ring-2 ring-[var(--sti-gold)]' : ''}`}
        >
          <p className="text-2xl font-bold" style={{ color: 'var(--card-foreground)' }}>{rows.length}</p>
          <p className="text-xs ef-muted mt-0.5">All Requests</p>
        </button>
        {STAGES.map((s) => (
          <button
            key={s.status}
            onClick={() => setFilter(s.status)}
            className={`ef-card rounded-xl shadow-sm p-3 text-left transition-shadow duration-200 ease-[var(--ease-out)] hover:shadow-md ${filter === s.status ? 'ring-2 ring-[var(--sti-gold)]' : ''}`}
          >
            <p className="text-2xl font-bold" style={{ color: 'var(--card-foreground)' }}>{counts[s.status] ?? 0}</p>
            <p className="text-xs ef-muted mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="ef-card rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b ef-border text-left text-xs font-semibold ef-muted uppercase tracking-wide">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((r) => {
              const open = openFor(r.status)
              return (
                <tr key={r.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--card-foreground)' }}>{r.name}</td>
                  <td className="px-4 py-3 ef-muted">{r.section ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div style={{ color: 'var(--card-foreground)' }}>{r.subject_name}</div>
                    <div className="text-xs ef-muted">{r.subject_code}</div>
                  </td>
                  <td className="px-4 py-3 capitalize ef-muted">{r.exam_type === 'paid' ? 'Paid' : 'Excused'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                    {r.status === 'rejected' && (
                      <div className="mt-1 text-xs">
                        <span className="font-medium text-red-600 dark:text-red-400">
                          Rejected by {ROLE_LABEL[r.rejected_by_role ?? ''] ?? 'a reviewer'}
                        </span>
                        {r.rejection_reason && <div className="ef-muted mt-0.5 max-w-xs">{r.rejection_reason}</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 ef-muted">{new Date(r.submitted_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {open && (
                      <Link
                        href={open.href(r.id)}
                        className="inline-block text-xs px-2.5 py-1 rounded-lg font-semibold"
                        style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                      >
                        {open.label}
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center ef-muted">No requests in this stage.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
