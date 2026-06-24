'use client'

import { useState, useTransition } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { overrideAccept } from '../actions'
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
}

const STAGES: { status: RequestStatus; label: string }[] = [
  { status: 'submitted', label: 'Waiting for Registrar' },
  { status: 'verified_by_registrar', label: 'Waiting for Teacher' },
  { status: 'approved_by_teacher', label: 'Waiting for Program Head' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'receipt_uploaded', label: 'Receipt to verify' },
  { status: 'scheduled', label: 'Scheduled' },
  { status: 'rejected', label: 'Rejected' },
]

// Stages an authorized PH can fast-track straight to "accepted"
const OVERRIDABLE: RequestStatus[] = ['submitted', 'verified_by_registrar', 'approved_by_teacher']

export default function OverviewClient({ rows, canOverride }: { rows: OverviewRow[]; canOverride: boolean }) {
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  function handleOverride(id: string) {
    if (!confirm('Accept this request now, bypassing the registrar/teacher steps?')) return
    startTransition(async () => {
      const res = await overrideAccept(id, '')
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Requests Overview</h2>
          <p className="text-sm ef-muted">Click a stage to filter. {canOverride && 'You can fast-track pending requests.'}</p>
        </div>
        {canOverride && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            ⚡ Override authorized
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Clickable stage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`ef-card rounded-xl shadow-sm p-3 text-left transition-all hover:shadow-md ${filter === 'all' ? 'ring-2 ring-[var(--sti-gold)]' : ''}`}
        >
          <p className="text-2xl font-bold" style={{ color: 'var(--card-foreground)' }}>{rows.length}</p>
          <p className="text-xs ef-muted mt-0.5">All Requests</p>
        </button>
        {STAGES.map((s) => (
          <button
            key={s.status}
            onClick={() => setFilter(s.status)}
            className={`ef-card rounded-xl shadow-sm p-3 text-left transition-all hover:shadow-md ${filter === s.status ? 'ring-2 ring-[var(--sti-gold)]' : ''}`}
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
              {canOverride && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--card-foreground)' }}>{r.name}</td>
                <td className="px-4 py-3 ef-muted">{r.section ?? '—'}</td>
                <td className="px-4 py-3">
                  <div style={{ color: 'var(--card-foreground)' }}>{r.subject_name}</div>
                  <div className="text-xs ef-muted">{r.subject_code}</div>
                </td>
                <td className="px-4 py-3 capitalize ef-muted">{r.exam_type === 'paid' ? 'Paid' : 'Excused'}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 ef-muted">{new Date(r.submitted_at).toLocaleDateString()}</td>
                {canOverride && (
                  <td className="px-4 py-3">
                    {OVERRIDABLE.includes(r.status) && (
                      <button
                        onClick={() => handleOverride(r.id)}
                        disabled={isPending}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50"
                        style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                      >
                        ⚡ Accept now
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={canOverride ? 7 : 6} className="px-4 py-8 text-center ef-muted">No requests in this stage.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
