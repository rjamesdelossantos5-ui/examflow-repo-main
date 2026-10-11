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
  /** A paid request the Registrar has assessed (payment_assessed_at set). */
  assessed: boolean
}

// 'accepted' (the Program Head accepted a paid request) is split in two, because
// the status doesn't change when the Registrar assesses it: first it waits for
// the Registrar's assessment, then for the student to pay and upload a receipt.
type Stage = Exclude<RequestStatus, 'accepted' | 'scheduled'> | 'to_assess' | 'to_pay'

const stageOf = (r: OverviewRow): Stage =>
  r.status === 'accepted' ? (r.assessed ? 'to_pay' : 'to_assess') : (r.status as Stage)

// 'scheduled' is intentionally omitted — scheduled requests drop off the overview.
const STAGES: { status: Stage; label: string; badge?: string }[] = [
  { status: 'submitted', label: 'Waiting for Registrar' },
  { status: 'verified_by_registrar', label: 'Waiting for Teacher' },
  { status: 'approved_by_teacher', label: 'Waiting for Program Head' },
  { status: 'to_assess', label: 'Waiting for assessment', badge: 'Awaiting assessment' },
  { status: 'to_pay', label: 'Waiting for payment', badge: 'Awaiting payment' },
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
  const [filter, setFilter] = useState<Stage | 'all'>('all')

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const s = stageOf(r)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const visible = filter === 'all' ? rows : rows.filter((r) => stageOf(r) === filter)
  const openFor = (r: OverviewRow) => {
    // Once assessed, it waits on the student — nothing to open.
    if (r.status === 'accepted' && r.assessed) return null
    const o = OPEN[r.status]
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

      {/* One card: a single row of stage filters, then the table. The filters
          used to be seven big number cards in two rows that pushed the table
          (the actual work) down the page. Scrolls sideways on phones. */}
      <div className="ef-card rounded-xl shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto no-scrollbar border-b ef-border px-2" aria-label="Filter by stage">
          {[{ status: 'all' as const, label: 'All Requests', count: rows.length }, ...STAGES.map((s) => ({ ...s, count: counts[s.status] ?? 0 }))].map((s) => {
            const active = filter === s.status
            return (
              <button
                key={s.status}
                type="button"
                onClick={() => setFilter(s.status)}
                aria-pressed={active}
                className={`relative shrink-0 flex items-center gap-2 px-3 py-3 text-sm whitespace-nowrap transition-colors ${active ? 'font-semibold' : 'ef-muted hover:text-[var(--card-foreground)]'}`}
                style={active ? { color: 'var(--card-foreground)' } : undefined}
              >
                {s.label}
                <span
                  className={`tabular-nums text-xs px-1.5 py-0.5 rounded-full ${s.count === 0 && !active ? 'opacity-60' : ''}`}
                  style={{ background: active ? 'color-mix(in srgb, var(--sti-gold) 25%, transparent)' : 'color-mix(in srgb, var(--muted) 12%, transparent)' }}
                >
                  {s.count}
                </span>
                {active && <span aria-hidden className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full" style={{ background: 'var(--sti-gold)' }} />}
              </button>
            )
          })}
        </div>
      <div className="overflow-x-auto">
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
              const open = openFor(r)
              const badge = STAGES.find((s) => s.status === stageOf(r))?.badge
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
                    <StatusBadge status={r.status} label={badge} />
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
    </div>
  )
}
