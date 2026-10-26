'use client'

import { useErrorToast, toastSuccess } from '@/components/Toaster'
import { useState, useTransition } from 'react'
import { markPaymentAssessed } from '../actions'
import { totalFee, formatPeso } from '@/lib/fees'
import { ordinalYear } from '@/lib/ordinal'
import { Icon } from '@/components/Icon'

/** One bill: a student's subjects assessed together, or all of their subjects
 *  still awaiting assessment. A student can have several (see page.tsx). */
export interface StudentAssessment {
  /** Unique per bill: the student plus the assessment stamp (or "pending"). */
  key: string
  studentId: string
  name: string
  studentNumber: string | null
  course: string | null
  yearLevel: number | null
  section: string | null
  /** assessedFee: the fee locked in when this student was assessed; null if
   *  not assessed yet (or assessed before migration_fee_setting.sql). */
  subjects: { id: string; code: string; name: string; assessedFee: number | null }[]
  /** When the Registrar totalled this bill and told the Cashier. Null = still
   *  awaiting assessment, and the student cannot upload a receipt for these
   *  subjects yet. */
  assessedAt: string | null
}

export default function AssessmentList({
  students,
  migrated,
  fee,
}: {
  students: StudentAssessment[]
  migrated: boolean
  /** The current fee per subject, set by the admin. */
  fee: number
}) {
  /** Request ids assessed from this page, before the server data catches up. */
  const [done, setDone] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<'pending' | 'assessed'>('pending')
  const [query, setQuery] = useState('')

  function assess(bill: StudentAssessment) {
    setError(null)
    setBusyKey(bill.key)
    startTransition(async () => {
      const res = await markPaymentAssessed(bill.studentId, fee)
      setBusyKey(null)
      if (res.error) { setError(res.error); return }
      // Move the row locally so it drops out of the pending tab immediately,
      // rather than waiting for a revalidate round-trip. Tracked by request,
      // not by student, so a subject accepted later still shows as awaiting.
      setDone((s) => new Set([...s, ...bill.subjects.map((sub) => sub.id)]))
      toastSuccess('Payment assessed')
    })
  }

  const isAssessed = (s: StudentAssessment) => !!s.assessedAt || s.subjects.every((sub) => done.has(sub.id))
  const pending = students.filter((s) => !isAssessed(s))
  const assessed = students.filter(isAssessed)

  // Search by name, student number, course, section or subject code.
  const q = query.trim().toLowerCase()
  const matches = (s: StudentAssessment) =>
    !q || [s.name, s.studentNumber, s.course, s.section, ...s.subjects.map((x) => x.code)]
      .some((v) => v && v.toLowerCase().includes(q))
  const list = (tab === 'pending' ? pending : assessed).filter(matches)

  // Assessed: the fee locked in at assessment. Pending: today's fee.
  const amountOf = (s: StudentAssessment) =>
    isAssessed(s) ? s.subjects.reduce((sum, sub) => sum + (sub.assessedFee ?? fee), 0) : totalFee(s.subjects.length, fee)

  const TABS = [
    { key: 'pending' as const, label: 'Awaiting assessment', count: pending.length },
    { key: 'assessed' as const, label: 'Assessed', count: assessed.length },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Payment Assessment</h1>
        <p className="text-sm ef-muted mt-1">
          Paid special exams accepted by the Program Head. Confirm the amount each student owes and mark it assessed;
          the student can upload the official receipt only after that.
        </p>
      </div>

      {!migrated && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          <strong>Not set up yet.</strong> Run <code>supabase/migration_payment_assessment.sql</code> in the Supabase SQL
          editor. Until then this list is read-only and students can upload receipts without being assessed.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* One card: tabs and search on top, then a table. Same pattern as the
          requests overview. */}
      <div className="ef-card rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b ef-border px-2 sm:pr-3">
          <div className="flex overflow-x-auto no-scrollbar" aria-label="Assessment status">
            {TABS.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-pressed={active}
                  className={`relative shrink-0 flex items-center gap-2 px-3 py-3 text-sm whitespace-nowrap transition-colors ${active ? 'font-semibold' : 'ef-muted hover:text-[var(--card-foreground)]'}`}
                  style={active ? { color: 'var(--card-foreground)' } : undefined}
                >
                  {t.label}
                  <span
                    className={`tabular-nums text-xs px-1.5 py-0.5 rounded-full ${t.count === 0 && !active ? 'opacity-60' : ''}`}
                    style={{ background: active ? 'color-mix(in srgb, var(--sti-yellow) 25%, transparent)' : 'color-mix(in srgb, var(--muted) 12%, transparent)' }}
                  >
                    {t.count}
                  </span>
                  {active && <span aria-hidden className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full" style={{ background: 'var(--sti-yellow)' }} />}
                </button>
              )
            })}
          </div>
          <div className="relative px-1 pb-2 sm:p-0 sm:w-80">
            <Icon name="search" className="absolute left-4 sm:left-3 top-[calc(50%-0.25rem)] sm:top-1/2 -translate-y-1/2 w-4 h-4 ef-muted pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search students"
              placeholder="Search name, student no., section, subject"
              className="w-full rounded-lg pl-9 pr-3 py-2 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-blue)] focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b ef-border text-left text-xs font-semibold ef-muted">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Course and section</th>
                <th className="px-4 py-3">Subjects</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">{tab === 'pending' ? 'Action' : 'Assessed on'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {list.map((s) => (
                <tr key={s.key} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--card-foreground)' }}>{s.name}</div>
                    <div className="text-xs ef-muted tabular-nums">{s.studentNumber ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 ef-muted whitespace-nowrap">
                    {[s.course, s.yearLevel ? ordinalYear(s.yearLevel) : null].filter(Boolean).join(' · ') || '—'}
                    {s.section && <div className="text-xs">{s.section}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-0.5">
                      {s.subjects.map((sub) => (
                        <li key={sub.id}>
                          <span className="font-medium" style={{ color: 'var(--card-foreground)' }}>{sub.code}</span>{' '}
                          <span className="ef-muted">{sub.name}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="font-semibold tabular-nums" style={{ color: 'var(--card-foreground)' }}>{formatPeso(amountOf(s))}</div>
                    {tab === 'pending' && (
                      <div className="text-xs ef-muted tabular-nums">{s.subjects.length} × {formatPeso(fee)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {tab === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => assess(s)}
                        disabled={!migrated || isPending}
                        className="ef-press px-3.5 py-2 rounded-lg font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: 'var(--sti-yellow)', color: 'var(--sti-navy)' }}
                      >
                        {busyKey === s.key ? 'Recording…' : 'Mark assessed'}
                      </button>
                    ) : (
                      <span className="ef-muted tabular-nums">
                        {s.assessedAt ? new Date(s.assessedAt).toLocaleDateString() : 'Just now'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center ef-muted">
                    {q ? 'No students match your search.' : tab === 'pending' ? 'No students are awaiting assessment.' : 'No students have been assessed yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
