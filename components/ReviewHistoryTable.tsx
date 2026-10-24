'use client'

import { useCallback, useState } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { Icon } from '@/components/Icon'
import { useEscapeKey } from '@/lib/useEscapeKey'
import type { RequestStatus } from '@/lib/supabase/types'

/** What a row shows when opened: the submitted details and when the teacher approved it. */
export interface HistoryDetail {
  name: string
  studentNumber: string | null
  course: string | null
  yearLevel: number | null
  section: string | null
  contact: string | null
  /** When the Subject Teacher approved it (ISO); null if there is no such entry. */
  approvedAt: string | null
}

export interface HistoryRow {
  id: string
  student: string
  subject: string
  exam_type: string
  status: RequestStatus
  date: string
  rejection_reason: string | null
  rejected_by_role: string | null
  /** When given, the row opens to show these (otherwise only a rejected row opens). */
  detail?: HistoryDetail
}

// "Oct 16, 2026, 2:35 PM" in the school's time zone, as on the student's page.
const stampFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit',
})

/**
 * Reviewed-history table (Teacher). Clicking a row opens a pop-up with the form's
 * details and when the teacher approved it; a rejected request also shows its
 * rejection reason.
 */
export default function ReviewHistoryTable({ title, rows }: { title: string; rows: HistoryRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const open = rows.find((r) => r.id === openId) ?? null
  const close = useCallback(() => setOpenId(null), [])
  useEscapeKey(close, !!open)

  const q = query.trim().toLowerCase()
  const filtered = q ? rows.filter((r) => r.student.toLowerCase().includes(q)) : rows

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{title}</h2>
        <div className="relative w-full sm:w-72">
          <Icon name="user" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ef-muted pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student name…"
            className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm border shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)] focus:border-transparent"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--card-foreground)' }}
          />
        </div>
      </div>
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
            {filtered.map((r) => {
              // Rows with something to show open a pop-up; the rest stay plain.
              const openable = r.status === 'rejected' || !!r.detail
              return (
                <tr
                  key={r.id}
                  onClick={openable ? () => setOpenId(r.id) : undefined}
                  className={openable ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--card-foreground)' }}>
                    {openable ? (
                      // A real button too, so the keyboard and screen readers can open it.
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenId(r.id) }}
                        className="text-left hover:underline underline-offset-2"
                        title="Open this request"
                      >
                        {r.student}
                      </button>
                    ) : r.student}
                  </td>
                  <td className="px-4 py-3 ef-muted">{r.subject}</td>
                  <td className="px-4 py-3 capitalize ef-muted">{r.exam_type}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 ef-muted">{new Date(r.date).toLocaleDateString()}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center ef-muted">{rows.length === 0 ? 'No history yet.' : 'No student matches your search.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="ef-overlay fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-request-title"
            className="ef-dialog ef-card rounded-2xl shadow-xl w-full max-w-xl md:max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="history-request-title" className="font-bold text-lg md:text-2xl" style={{ color: 'var(--card-foreground)' }}>Request details</h3>
                <p className="text-sm md:text-base ef-muted">{open.subject}</p>
              </div>
              <StatusBadge status={open.status} />
            </div>
            <div className="mt-5 md:mt-7 space-y-4">
              {open.status === 'rejected' && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm md:text-base text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                  {open.rejection_reason || 'No reason recorded.'}
                </div>
              )}
              {open.detail && <Detail d={open.detail} />}
            </div>
            <div className="mt-6 md:mt-8 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="px-5 py-2.5 md:px-7 md:py-3 rounded-lg text-sm md:text-base font-semibold"
                style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Laid out like the student's own request page: Submitted Details, plus one line
// for when the teacher approved it. The parent/guardian identity check is for the
// Registrar and Program Head only, so it is not shown here.
function Detail({ d }: { d: HistoryDetail }) {
  const fields: [string, string][] = [
    ['Name', d.name],
    ['Contact No.', d.contact ?? '—'],
    ['Student No.', d.studentNumber ?? '—'],
    ['Course', d.course ?? '—'],
    ['Year', d.yearLevel ? String(d.yearLevel) : '—'],
    ['Section', d.section ?? '—'],
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--card-foreground)' }}>Submitted Details</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 md:gap-x-8 gap-y-3 md:gap-y-5 text-sm md:text-base">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs md:text-sm ef-muted">{label}</dt>
              <dd className="font-medium" style={{ color: 'var(--card-foreground)' }}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {d.approvedAt && (
        <p className="text-sm md:text-base ef-muted">
          Approved by Subject Teacher: <span className="font-medium" style={{ color: 'var(--card-foreground)' }}>{stampFmt.format(new Date(d.approvedAt))}</span>
        </p>
      )}
    </div>
  )
}
