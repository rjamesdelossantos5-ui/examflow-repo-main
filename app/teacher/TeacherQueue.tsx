'use client'

import { useErrorToast, toastSuccess, withSuccessToast } from '@/components/Toaster'
import { useState, useEffect, useCallback, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import RequestReviewPanel from '@/components/RequestReviewPanel'
import MarkViewed from '@/components/MarkViewed'
import StatusBadge from '@/components/StatusBadge'
import Pagination, { usePagination } from '@/components/Pagination'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { approveRequest, approveAll } from './actions'
import type { RequestStatus } from '@/lib/supabase/types'

interface RequestRow {
  id: string
  exam_type: string
  excused_reason: string | null
  other_reason: string | null
  status: RequestStatus
  submitted_at: string
  resubmitted?: boolean
  student: { full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null; contact_number: string | null }
  teacherName?: string | null
  subject: { subject_code: string; subject_name: string }
  media: { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string; signed_url?: string }[]
  logs: { id: string; action: string; created_at: string; actor_role: string }[]
}

/**
 * Teacher's pending queue: one row per request (student, section, subject, type,
 * stage, date). Clicking a row opens that request in a pop-up with the review
 * panel and its Approve button. Approving removes the row immediately (optimistic) — the server
 * round trip happens in the background via the actions in ./actions.
 *
 * The teacher can only approve. There is no reject here: only the Program Head
 * can reject, and only the Program Head sees the parent-list check.
 */
export default function TeacherQueue({ requests }: { requests: RequestRow[] }) {
  const reqParam = useSearchParams().get('req')
  // Local copy of the server-rendered list so handled forms can be dropped
  // instantly; re-synced whenever the server sends a fresh list (LiveRefresh).
  const [items, setItems] = useState(requests)
  useEffect(() => setItems(requests), [requests])

  // The request open in the pop-up (null = closed). Kept as an id so the pop-up
  // follows the list: it closes by itself when that request is approved.
  const [openId, setOpenId] = useState<string | null>(null)
  const open = items.find((r) => r.id === openId) ?? null
  const close = useCallback(() => setOpenId(null), [])
  useEscapeKey(close, !!open)

  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)
  const [isPending, startTransition] = useTransition()

  // ?req=<id> (from a notification-bell link) opens straight to that request.
  useEffect(() => {
    if (!reqParam) return
    if (requests.some((r) => r.id === reqParam)) setOpenId(reqParam)
  }, [reqParam, requests])

  const pager = usePagination(items, 'all')

  function dropForm(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id))
    setOpenId(null)
  }

  // The same student's other pending forms, so all of them can be approved in one go.
  const siblings = open
    ? items.filter((r) => r.status === 'submitted' && r.student.full_name === open.student.full_name)
    : []

  function approveStudent() {
    const ids = siblings.map((f) => f.id)
    if (!ids.length) return
    setError(null)
    startTransition(async () => {
      const res = await approveAll(ids)
      if (res.error) setError(res.error)
      else {
        setItems((prev) => prev.filter((r) => !ids.includes(r.id)))
        setOpenId(null)
        toastSuccess(ids.length === 1 ? 'Request approved' : `${ids.length} requests approved`)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Opening a request counts as viewing it: the bell stops flagging it as new. */}
      <MarkViewed ids={open ? [open.id] : []} />
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Requests Awaiting Your Approval</h2>
        <p className="text-sm ef-muted">Click a request to read it and approve it.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="ef-card rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b ef-border text-left text-xs font-semibold ef-muted uppercase tracking-wide">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pager.items.map((r) => (
                // The whole row opens the request. The name is also a real button,
                // so the keyboard and screen readers can open it too.
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--card-foreground)' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenId(r.id) }}
                      className="text-left hover:underline underline-offset-2"
                      title="Open this request"
                    >
                      {r.student.full_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 ef-muted whitespace-nowrap">{r.student.section ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--card-foreground)' }}>{r.subject.subject_name}</td>
                  <td className="px-4 py-3 ef-muted">{r.exam_type === 'paid' ? 'Paid' : 'Waived'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={r.status} />
                    {r.resubmitted && <span className="ml-1.5 px-1.5 py-0.5 rounded text-3xs font-semibold bg-blue-100 text-blue-700">Resubmitted</span>}
                  </td>
                  <td className="px-4 py-3 ef-muted whitespace-nowrap">{new Date(r.submitted_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center ef-muted">No pending requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination {...pager.pagerProps} />

      {/* The request's details and its Approve button, in a pop-up. */}
      {open && (
        <div className="ef-overlay fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Request from ${open.student.full_name}`}
            className="ef-dialog ef-card rounded-2xl shadow-xl w-full max-w-3xl lg:max-w-5xl max-h-[92vh] overflow-y-auto p-5 sm:p-8 lg:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            <RequestReviewPanel
              key={open.id}
              requestId={open.id}
              studentName={open.student.full_name}
              teacherName={open.teacherName}
              studentInfo={open.student}
              subjectName={open.subject.subject_name}
              subjectCode={open.subject.subject_code}
              examType={open.exam_type}
              excusedReason={open.excused_reason}
              otherReason={open.other_reason}
              status={open.status}
              media={open.media}
              logs={open.logs}
              onVerify={withSuccessToast(approveRequest, 'Request approved')}
              onDone={() => dropForm(open.id)}
              verifyLabel="Approve & Forward to Program Head"
              showDocuments={false}
            />
            {siblings.length > 1 && (
              <button
                type="button"
                onClick={approveStudent}
                disabled={isPending}
                className="mt-4 w-full py-2.5 rounded-lg font-semibold text-sm border ef-border disabled:opacity-50"
                style={{ color: 'var(--card-foreground)' }}
              >
                {isPending ? 'Approving…' : `Approve all ${siblings.length} of this student's forms`}
              </button>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                style={{ color: 'var(--card-foreground)' }}
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
