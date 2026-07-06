'use client'

import { useState, useTransition } from 'react'
import { approveOverride, denyOverride } from './actions'

export interface OverrideRow {
  id: string
  reasonType: string
  reasonNote: string | null
  createdAt: string
  requestedBy: string
  studentName: string
  subjectCode: string
  subjectName: string
  currentStage: string
}

const REASON_LABEL: Record<string, string> = {
  absent: 'Absent',
  on_leave: 'On leave',
  other: 'Other',
}
const STAGE_LABEL: Record<string, string> = {
  submitted: 'Waiting for Registrar',
  verified_by_registrar: 'Waiting for Teacher',
  approved_by_teacher: 'Waiting for Program Head',
}

export default function OverrideList({ initial }: { initial: OverrideRow[] }) {
  const [rows, setRows] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function act(id: string, kind: 'approve' | 'deny') {
    setBusy(id)
    setError(null)
    startTransition(async () => {
      const res = kind === 'approve' ? await approveOverride(id) : await denyOverride(id)
      setBusy(null)
      if (res.error) setError(res.error)
      else setRows((rs) => rs.filter((r) => r.id !== id))
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Override Requests</h2>
        <p className="text-sm ef-muted">Program Heads asking to fast-track a stuck request (e.g. a reviewer is absent).</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="ef-card rounded-xl shadow-sm px-4 py-12 text-center ef-muted">No pending override requests.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="ef-card rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold" style={{ color: 'var(--card-foreground)' }}>{r.studentName}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">{REASON_LABEL[r.reasonType] ?? r.reasonType}</span>
                </div>
                <p className="text-sm ef-muted">{r.subjectCode} — {r.subjectName}</p>
                <p className="text-xs ef-muted mt-1">
                  Requested by <strong style={{ color: 'var(--card-foreground)' }}>{r.requestedBy}</strong>
                  {' · '}{STAGE_LABEL[r.currentStage] ?? r.currentStage}
                  {' · '}{new Date(r.createdAt).toLocaleString()}
                </p>
                {r.reasonNote && <p className="text-sm mt-1.5" style={{ color: 'var(--card-foreground)' }}>&ldquo;{r.reasonNote}&rdquo;</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => act(r.id, 'approve')}
                  disabled={busy === r.id}
                  className="px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                >
                  {busy === r.id ? '…' : 'Approve'}
                </button>
                <button
                  onClick={() => act(r.id, 'deny')}
                  disabled={busy === r.id}
                  className="px-4 py-2 rounded-lg font-semibold text-sm border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
