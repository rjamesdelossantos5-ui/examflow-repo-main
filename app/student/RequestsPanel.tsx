'use client'

import { useState } from 'react'
import Link from 'next/link'
import RequestStepper from '@/components/RequestStepper'
import { Icon, type IconName } from '@/components/Icon'
import type { RequestStatus } from '@/lib/supabase/types'

// The "In Progress" bucket = every status that isn't finished (scheduled) or
// rejected. Kept in sync with the stat card below.
const IN_PROGRESS: RequestStatus[] = [
  'submitted', 'verified_by_registrar', 'approved_by_teacher', 'accepted', 'receipt_uploaded',
]

type Filter = 'all' | 'inProgress' | 'scheduled' | 'rejected'

// Serializable shape passed from the (server) page — just what the cards need.
export interface StudentRequest {
  id: string
  status: RequestStatus
  exam_type: string
  submitted_at: string
  rejection_reason: string | null
  subject_code: string | null
  subject_name: string | null
}

// Friendly, student-facing status pill (label + tone color) for the card.
// Tones are theme-aware CSS variables so the pill text keeps AA contrast in
// both light and dark mode (see --status-* in globals.css).
function cardStatus(status: RequestStatus): { label: string; tone: string } {
  switch (status) {
    case 'submitted': return { label: 'Submitted', tone: 'var(--status-neutral)' }
    case 'verified_by_registrar': return { label: 'In Review', tone: 'var(--status-info)' }
    case 'approved_by_teacher': return { label: 'In Review', tone: 'var(--status-info)' }
    case 'accepted': return { label: 'Awaiting Receipt', tone: 'var(--status-warning)' }
    case 'receipt_uploaded': return { label: 'Receipt In Review', tone: 'var(--status-warning)' }
    case 'scheduled': return { label: 'Scheduled', tone: 'var(--status-success)' }
    case 'rejected': return { label: 'Rejected', tone: 'var(--status-danger)' }
    default: return { label: status, tone: 'var(--status-neutral)' }
  }
}

// "Filed 2d ago" — short relative time for the card subheader.
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// One summary tile. Doubles as a filter toggle — clicking sets the filter, and
// the active one gets a gold ring (same affordance as the PH Overview cards).
function StatCard({ label, value, accent, icon, active, onClick }: {
  label: string; value: number; accent: string; icon: IconName; active: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ef-card rounded-xl shadow-sm p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3 min-w-0 text-left w-full transition-shadow duration-200 ease-[var(--ease-out)] hover:shadow-md ${active ? 'ring-2 ring-[var(--sti-gold)]' : ''}`}
    >
      {/* color-mix (not hex + '22') because `accent` is now a CSS variable */}
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }}>
        <Icon name={icon} className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-2xl font-bold leading-none" style={{ color: 'var(--card-foreground)' }}>{value}</p>
        <p className="text-2xs sm:text-xs ef-muted mt-1 truncate">{label}</p>
      </div>
    </button>
  )
}

export default function RequestsPanel({ requests, termLabel, hasHistory }: {
  requests: StudentRequest[]
  termLabel: string | null
  hasHistory: boolean
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const counts = {
    total: requests.length,
    inProgress: requests.filter((r) => IN_PROGRESS.includes(r.status)).length,
    scheduled: requests.filter((r) => r.status === 'scheduled').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }

  const visible =
    filter === 'inProgress' ? requests.filter((r) => IN_PROGRESS.includes(r.status))
    : filter === 'scheduled' ? requests.filter((r) => r.status === 'scheduled')
    : filter === 'rejected' ? requests.filter((r) => r.status === 'rejected')
    : requests

  // Clicking the active filter again clears it back to "all".
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? 'all' : f))

  const filterLabel = filter === 'inProgress' ? 'in-progress' : filter === 'scheduled' ? 'scheduled' : filter === 'rejected' ? 'rejected' : ''

  return (
    <>
      {/* Stat cards — also act as status filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Requests" value={counts.total} accent="var(--status-neutral)" icon="layers" active={filter === 'all'} onClick={() => setFilter('all')} />
        <StatCard label="In Progress" value={counts.inProgress} accent="var(--status-info)" icon="clock" active={filter === 'inProgress'} onClick={() => toggle('inProgress')} />
        <StatCard label="Scheduled" value={counts.scheduled} accent="var(--status-success)" icon="calendar" active={filter === 'scheduled'} onClick={() => toggle('scheduled')} />
        <StatCard label="Rejected" value={counts.rejected} accent="var(--status-danger)" icon="x-circle" active={filter === 'rejected'} onClick={() => toggle('rejected')} />
      </div>

      {/* Request list */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold ef-muted uppercase tracking-wide">Your Requests</h2>
          {filter !== 'all' && (
            <button type="button" onClick={() => setFilter('all')} className="text-xs font-semibold underline ef-muted">
              Clear filter
            </button>
          )}
        </div>

        {requests.length === 0 ? (
          <div className="ef-card rounded-xl shadow-sm px-4 py-14 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center" style={{ background: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)' }}>
              <Icon name="file" className="w-6 h-6" style={{ color: 'var(--sti-gold)' }} />
            </div>
            <p className="font-medium" style={{ color: 'var(--card-foreground)' }}>No requests yet {termLabel ? `for ${termLabel}` : ''}</p>
            <p className="text-sm ef-muted mt-1">Start by submitting your first special exam request.</p>
            <Link
              href="/student/submit"
              className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              + Submit a Request
            </Link>
            {hasHistory && (
              <p className="text-sm ef-muted mt-3">
                Looking for an old request? Check your{' '}
                <Link href="/student/history" className="underline font-medium" style={{ color: 'var(--card-foreground)' }}>History</Link>.
              </p>
            )}
          </div>
        ) : visible.length === 0 ? (
          // The student has requests, but none match the active filter.
          <div className="ef-card rounded-xl shadow-sm px-4 py-10 text-center">
            <p className="font-medium" style={{ color: 'var(--card-foreground)' }}>No {filterLabel} requests.</p>
            <button type="button" onClick={() => setFilter('all')} className="text-sm underline font-medium mt-1" style={{ color: 'var(--card-foreground)' }}>
              Show all requests
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((r) => {
              const status = r.status
              const isPaid = r.exam_type === 'paid'
              // Paid + accepted = the cashier receipt still needs to be uploaded.
              const needsReceipt = isPaid && status === 'accepted'
              const isRejected = status === 'rejected'
              const pill = cardStatus(status)
              return (
                // The whole card links to the full detail page (files, submitted
                // details, activity timeline) via a stretched overlay link — but
                // the receipt / resubmit buttons sit ABOVE it (z-10) so they stay
                // independently clickable.
                <div key={r.id} className="ef-card relative rounded-2xl shadow-sm p-5 sm:p-6 transition-shadow hover:shadow-md">
                  <Link
                    href={`/student/requests/${r.id}`}
                    aria-label={`View details for ${r.subject_name ?? 'this request'}`}
                    className="absolute inset-0 rounded-2xl"
                  />

                  {/* Header: code, subject, type + filed time, status pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-2xs font-semibold uppercase tracking-wider ef-muted">{r.subject_code ?? '—'}</p>
                      <h3 className="text-lg font-bold leading-snug truncate" style={{ color: 'var(--card-foreground)' }}>
                        {r.subject_name ?? 'Unknown subject'}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-2xs font-semibold ${isPaid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'}`}>
                          {isPaid ? 'Paid exam' : 'Excused'}
                        </span>
                        <span className="text-xs ef-muted">Filed {timeAgo(r.submitted_at)}</span>
                      </div>
                    </div>
                    <span
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: `color-mix(in srgb, ${pill.tone} 14%, transparent)`, color: pill.tone }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: pill.tone }} />
                      {pill.label}
                    </span>
                  </div>

                  {/* Inline progress rail (rejected shows the strip below instead) */}
                  {!isRejected && (
                    <div className="mt-5">
                      <RequestStepper status={status} paid={isPaid} />
                    </div>
                  )}

                  {/* Fast receipt action — full upload form is on the detail page.
                      Text and button sit next to each other rather than pinned to
                      opposite edges: on a full-width card, `flex-1` on the text
                      left a large empty gap between them. */}
                  {needsReceipt && (
                    <div
                      className="relative z-10 mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-xl px-4 py-3"
                      style={{ background: 'color-mix(in srgb, var(--status-warning) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--status-warning) 35%, transparent)' }}
                    >
                      <p className="text-sm" style={{ color: 'var(--card-foreground)' }}>
                        <strong>Payment accepted.</strong> <span className="ef-muted">Upload your cashier receipt to get scheduled.</span>
                      </p>
                      <Link
                        href={`/student/requests/${r.id}`}
                        className="ef-press shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                        style={{ background: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                      >
                        <Icon name="upload" className="w-4 h-4" /> Upload receipt
                      </Link>
                    </div>
                  )}

                  {/* Fast resubmit action when rejected */}
                  {isRejected && (
                    <div className="relative z-10 mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-xl px-4 py-3 bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        <strong>Rejected.</strong> {r.rejection_reason ? r.rejection_reason : 'Fix the issue and resubmit — your details are kept.'}
                      </p>
                      <Link
                        href={`/student/submit?from=${r.id}`}
                        className="ef-press shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                        style={{ background: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                      >
                        <Icon name="pencil" className="w-4 h-4" /> Edit &amp; Resubmit
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
