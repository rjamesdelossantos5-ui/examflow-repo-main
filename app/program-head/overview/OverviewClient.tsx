'use client'

import { useCallback, useState, useTransition } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { overrideAccept, requestOverride } from '../actions'
import type { RequestStatus } from '@/lib/supabase/types'

export type OverrideStatus = 'none' | 'pending' | 'approved' | 'denied'

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
  overrideStatus: OverrideStatus
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

// Stages that can be fast-tracked straight to "accepted"
const OVERRIDABLE: RequestStatus[] = ['submitted', 'verified_by_registrar', 'approved_by_teacher']

const REASONS = [
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'other', label: 'Other' },
] as const

export default function OverviewClient({ rows, canOverride }: { rows: OverviewRow[]; canOverride: boolean }) {
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Row currently being requested (opens the reason modal)
  const [requestFor, setRequestFor] = useState<OverviewRow | null>(null)
  const [reasonType, setReasonType] = useState<'absent' | 'on_leave' | 'other'>('absent')
  const [reasonNote, setReasonNote] = useState('')
  const closeRequestModal = useCallback(() => setRequestFor(null), [])
  useEscapeKey(closeRequestModal, requestFor !== null)

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  function handleAccept(id: string) {
    if (!confirm('Accept this request now, bypassing the earlier steps?')) return
    startTransition(async () => {
      const res = await overrideAccept(id, '')
      if (res.error) setError(res.error)
    })
  }

  function submitRequest() {
    if (!requestFor) return
    if (reasonType === 'other' && !reasonNote.trim()) { setError('Please describe the reason.'); return }
    const id = requestFor.id
    startTransition(async () => {
      const res = await requestOverride(id, reasonType, reasonNote)
      if (res.error) setError(res.error)
      else { setRequestFor(null); setReasonNote(''); setReasonType('absent') }
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>All Requests Overview</h2>
        <p className="text-sm ef-muted">
          Click a stage to filter.{' '}
          {canOverride ? 'You can fast-track pending requests directly.' : 'Ask the admin to fast-track a stuck request.'}
        </p>
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
              // The whole row is a shortcut for accepting when this PH is allowed
              // to (globally authorized, or the admin approved this exact request).
              const canAcceptHere = OVERRIDABLE.includes(r.status) && (canOverride || r.overrideStatus === 'approved')
              return (
              <tr
                key={r.id}
                onClick={canAcceptHere ? () => handleAccept(r.id) : undefined}
                title={canAcceptHere ? 'Click to accept this request now' : undefined}
                className={`hover:bg-black/5 dark:hover:bg-white/5 ${canAcceptHere ? 'cursor-pointer' : ''}`}
              >
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
                <td className="px-4 py-3 text-right">
                  {OVERRIDABLE.includes(r.status) && (
                    canOverride || r.overrideStatus === 'approved' ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAccept(r.id) }}
                        disabled={isPending}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50"
                        style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                      >
                        {canOverride ? 'Accept now' : 'Accept as Program Head'}
                      </button>
                    ) : r.overrideStatus === 'pending' ? (
                      <span className="text-xs ef-muted">Awaiting admin…</span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRequestFor(r) }}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold border ef-border hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: 'var(--card-foreground)' }}
                      >
                        {r.overrideStatus === 'denied' ? 'Request again' : 'Request approval'}
                      </button>
                    )
                  )}
                </td>
              </tr>
            )})}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center ef-muted">No requests in this stage.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reason modal — request admin override */}
      {requestFor && (
        <div className="ef-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setRequestFor(null)}>
          <div className="ef-dialog ef-card rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>Request admin approval</h3>
            <p className="text-sm ef-muted mt-0.5 mb-4">
              For <strong style={{ color: 'var(--card-foreground)' }}>{requestFor.name}</strong> — {requestFor.subject_code}
            </p>

            <label className="block text-xs font-semibold uppercase tracking-wide ef-muted mb-2">Reason</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {REASONS.map((rr) => (
                <button
                  key={rr.value}
                  type="button"
                  onClick={() => setReasonType(rr.value)}
                  className="py-2 rounded-lg text-sm font-semibold border transition-colors"
                  style={reasonType === rr.value
                    ? { backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)', borderColor: 'var(--sti-gold)' }
                    : { borderColor: 'var(--border)', color: 'var(--card-foreground)' }}
                >
                  {rr.label}
                </button>
              ))}
            </div>

            {reasonType === 'other' && (
              <textarea
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Describe the reason…"
                className="w-full rounded-lg px-3 py-2 text-sm bg-transparent border ef-border resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]"
              />
            )}

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setRequestFor(null)}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border"
                style={{ color: 'var(--card-foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
              >
                {isPending ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
