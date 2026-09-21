'use client'

import { useState, useTransition } from 'react'
import { markPaymentAssessed } from '../actions'
import { totalFee, formatPeso, SPECIAL_EXAM_FEE } from '@/lib/fees'
import { ordinalYear } from '@/lib/ordinal'

export interface StudentAssessment {
  studentId: string
  name: string
  studentNumber: string | null
  course: string | null
  yearLevel: number | null
  section: string | null
  subjects: { id: string; code: string; name: string }[]
  /** Set once the Registrar has totalled this student's fees and told the
   *  Cashier. Null = still awaiting assessment, and the student cannot upload a
   *  receipt yet. */
  assessedAt: string | null
}

export default function AssessmentList({
  students,
  migrated,
}: {
  students: StudentAssessment[]
  migrated: boolean
}) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function assess(studentId: string) {
    setError(null)
    setBusyId(studentId)
    startTransition(async () => {
      const res = await markPaymentAssessed(studentId)
      setBusyId(null)
      if (res.error) { setError(res.error); return }
      // Move the card locally so it drops out of the pending list immediately,
      // rather than waiting for a revalidate round-trip.
      setDone((s) => new Set(s).add(studentId))
    })
  }

  const isAssessed = (s: StudentAssessment) => !!s.assessedAt || done.has(s.studentId)
  const pending = students.filter((s) => !isAssessed(s))
  const assessed = students.filter(isAssessed)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Payment Assessment</h1>
        <p className="text-sm ef-muted mt-1">
          Students whose paid special exams the Program Head has approved. Check what each student owes, then mark
          them assessed — the student can only upload a receipt after that.
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

      {/* ── Awaiting assessment ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide ef-muted mb-3">
          Awaiting assessment ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed ef-border px-6 py-12 text-center ef-muted text-sm">
            Nothing awaiting assessment right now.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((s) => (
              <div key={s.studentId} className="ef-card rounded-xl shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold" style={{ color: 'var(--card-foreground)' }}>{s.name}</h3>
                    <p className="text-xs ef-muted mt-0.5">
                      {[s.studentNumber, s.course, s.yearLevel ? ordinalYear(s.yearLevel) : null, s.section]
                        .filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold" style={{ color: 'var(--card-foreground)' }}>
                      {formatPeso(totalFee(s.subjects.length))}
                    </p>
                    <p className="text-xs ef-muted">
                      {s.subjects.length} subject{s.subjects.length === 1 ? '' : 's'} × {formatPeso(SPECIAL_EXAM_FEE)}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1">
                  {s.subjects.map((sub) => (
                    <li key={sub.id} className="flex items-baseline gap-2 text-sm">
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: 'var(--sti-navy)', color: 'var(--sti-gold)' }}>
                        {sub.code}
                      </span>
                      <span className="ef-muted truncate">{sub.name}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => assess(s.studentId)}
                  disabled={!migrated || isPending}
                  className="mt-4 w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                >
                  {busyId === s.studentId ? 'Recording…' : `Mark Assessed — ${formatPeso(totalFee(s.subjects.length))}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Already assessed ────────────────────────────────────────────── */}
      {assessed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide ef-muted mb-3">
            Assessed — waiting for the student to pay ({assessed.length})
          </h2>
          <div className="space-y-2">
            {assessed.map((s) => (
              <div key={s.studentId} className="ef-card rounded-lg p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--card-foreground)' }}>{s.name}</p>
                  <p className="text-xs ef-muted">
                    {s.subjects.length} subject{s.subjects.length === 1 ? '' : 's'} · {formatPeso(totalFee(s.subjects.length))}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300 whitespace-nowrap">
                  ✓ Assessed
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
