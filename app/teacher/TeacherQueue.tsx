'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import RequestReviewPanel from '@/components/RequestReviewPanel'
import { Icon } from '@/components/Icon'
import { approveRequest, rejectTeacherRequest, approveAll } from './actions'
import { TEACHER_REJECT } from '@/lib/rejectReasons'
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

interface Group {
  key: string
  name: string
  forms: RequestRow[]
}

// One student = one card, no matter how many subjects they filed for. The
// teacher reviews per-student (all that student's forms open together in the
// detail pane) instead of hunting the same name across the list.
function groupByStudent(rows: RequestRow[]): Group[] {
  const map = new Map<string, Group>()
  for (const r of rows) {
    const key = r.student.full_name
    const g = map.get(key)
    if (g) g.forms.push(r)
    else map.set(key, { key, name: r.student.full_name, forms: [r] })
  }
  return [...map.values()]
}

/**
 * Teacher's pending queue: master list of students on the left, the selected
 * student's forms (approve / reject panels) on the right. Approving or
 * rejecting removes the form from the list immediately (optimistic) — the
 * server round trip happens in the background via the actions in ./actions.
 */
export default function TeacherQueue({ requests }: { requests: RequestRow[] }) {
  const reqParam = useSearchParams().get('req')
  // Local copy of the server-rendered list so handled forms can be dropped
  // instantly; re-synced whenever the server sends a fresh list (LiveRefresh).
  const [items, setItems] = useState(requests)
  useEffect(() => setItems(requests), [requests])

  const groups = groupByStudent(items)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const active = groups.find((g) => g.key === selectedKey) ?? null
  const detailRef = useRef<HTMLDivElement>(null)

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ?req=<id> (from a notification-bell link) opens straight to that
  // student's forms instead of landing on an unselected queue.
  useEffect(() => {
    if (!reqParam) return
    const form = requests.find((r) => r.id === reqParam)
    if (form) setSelectedKey(form.student.full_name)
  }, [reqParam, requests])

  // On phones the detail pane renders BELOW the list, so scroll it into view
  // when a student is picked (on desktop it's already visible side-by-side).
  useEffect(() => {
    if (selectedKey && typeof window !== 'undefined' && window.innerWidth < 768) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedKey])

  function dropForm(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  // "Approve all N forms" — one click approves every still-pending form of
  // the selected student (single DB update via approveAll).
  function approveGroup(g: Group) {
    const ids = g.forms.filter((f) => f.status === 'verified_by_registrar').map((f) => f.id)
    if (!ids.length) return
    setError(null)
    startTransition(async () => {
      const res = await approveAll(ids)
      if (res.error) setError(res.error)
      else setItems((prev) => prev.filter((r) => !ids.includes(r.id)))
    })
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>Requests Awaiting Your Approval</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {groups.length === 0 && (
        <div className="ef-card rounded-xl shadow-sm px-4 py-10 text-center ef-muted">No pending requests.</div>
      )}

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* Student list */}
        <div className="space-y-2.5">
          {groups.map((g) => {
            const pending = g.forms.filter((f) => f.status === 'verified_by_registrar').length
            const anyResub = g.forms.some((f) => f.resubmitted)
            return (
              <button
                key={g.key}
                onClick={() => setSelectedKey(g.key === selectedKey ? null : g.key)}
                className={`ef-card w-full text-left rounded-xl shadow-sm p-4 transition-all hover:shadow-md ${selectedKey === g.key ? 'ring-2 ring-[var(--sti-gold)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate flex items-center gap-2" style={{ color: 'var(--card-foreground)' }}>
                      {g.name}
                      {anyResub && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Resubmitted</span>}
                    </p>
                    <p className="text-sm ef-muted truncate">{g.forms.map((f) => f.subject.subject_code).join(', ')}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--sti-gold) 20%, transparent)', color: 'var(--card-foreground)' }}>
                    {pending} form{pending === 1 ? '' : 's'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail */}
        {groups.length > 0 && (
          <div className="md:sticky md:top-20" ref={detailRef}>
            {active ? (
              <div className="space-y-3">
                {active.forms.filter((f) => f.status === 'verified_by_registrar').length > 1 && (
                  <button
                    onClick={() => approveGroup(active)}
                    disabled={isPending}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                    style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                  >
                    {isPending ? 'Approving…' : `Approve all ${active.forms.filter((f) => f.status === 'verified_by_registrar').length} forms`}
                  </button>
                )}
                {active.forms.map((f) => (
                  <div key={f.id} className="ef-card rounded-xl shadow-sm p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide ef-muted mb-2">
                      {f.subject.subject_code} — {f.subject.subject_name}
                    </p>
                    <RequestReviewPanel
                      requestId={f.id}
                      studentName={f.student.full_name}
                      teacherName={f.teacherName}
                      studentInfo={f.student}
                      subjectName={f.subject.subject_name}
                      subjectCode={f.subject.subject_code}
                      examType={f.exam_type}
                      excusedReason={f.excused_reason}
                      otherReason={f.other_reason}
                      status={f.status}
                      media={f.media}
                      logs={f.logs}
                      onVerify={approveRequest}
                      onReject={rejectTeacherRequest}
                      onDone={() => dropForm(f.id)}
                      rejectPresets={TEACHER_REJECT}
                      verifyLabel="Approve & Forward to Program Head"
                      actionableStatus="verified_by_registrar"
                      showDocuments={false}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="hidden md:flex flex-col items-center justify-center rounded-xl border-2 border-dashed ef-border px-6 py-20 text-center ef-muted">
                <Icon name="file" className="w-8 h-8 mb-2 opacity-60" />
                <p className="text-sm">Select a student to review their forms.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
