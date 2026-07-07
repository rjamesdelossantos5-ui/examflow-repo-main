'use client'

import { useState } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { Icon } from '@/components/Icon'
import type { RequestStatus } from '@/lib/supabase/types'

export interface HistoryRow {
  id: string
  student: string
  subject: string
  exam_type: string
  status: RequestStatus
  date: string
  rejection_reason: string | null
  rejected_by_role: string | null
}

/**
 * Reviewed-history table shared by Registrar and Teacher. Rejected rows are
 * clickable and expand to show the rejection reason.
 */
export default function ReviewHistoryTable({ title, rows }: { title: string; rows: HistoryRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>{title}</h2>
      <div className="ef-card rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b ef-border text-left text-xs font-semibold ef-muted uppercase tracking-wide">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const rejected = r.status === 'rejected'
              const expanded = openId === r.id
              return (
                <FragmentRow
                  key={r.id}
                  r={r}
                  rejected={rejected}
                  expanded={expanded}
                  onToggle={() => setOpenId(expanded ? null : r.id)}
                />
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center ef-muted">No history yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  function FragmentRow({ r, rejected, expanded, onToggle }: { r: HistoryRow; rejected: boolean; expanded: boolean; onToggle: () => void }) {
    return (
      <>
        <tr
          className={rejected ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}
          onClick={rejected ? onToggle : undefined}
        >
          <td className="px-4 py-3 font-medium" style={{ color: 'var(--card-foreground)' }}>{r.student}</td>
          <td className="px-4 py-3 ef-muted">{r.subject}</td>
          <td className="px-4 py-3 capitalize ef-muted">{r.exam_type}</td>
          <td className="px-4 py-3">
            <span className="inline-flex items-center gap-1.5">
              <StatusBadge status={r.status} />
              {rejected && (
                <Icon name="chevron-right" className={`w-4 h-4 ef-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
              )}
            </span>
          </td>
          <td className="px-4 py-3 ef-muted">{new Date(r.date).toLocaleDateString()}</td>
        </tr>
        {rejected && expanded && (
          <tr>
            <td colSpan={5} className="px-4 pb-4 pt-0">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                {r.rejection_reason || 'No reason recorded.'}
              </div>
            </td>
          </tr>
        )}
      </>
    )
  }
}
