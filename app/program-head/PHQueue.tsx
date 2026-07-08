'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import type { RequestStatus } from '@/lib/supabase/types'
import { acceptRequest, rejectPHRequest, confirmReceipt, rejectReceipt, acceptAll } from './actions'
import { Icon } from '@/components/Icon'
import { getSignedUrl } from '@/app/media-actions'
import RejectReasonPicker from '@/components/RejectReasonPicker'
import { PH_REJECT_EXCUSED, PH_REJECT_PAID, PH_RECEIPT_REJECT } from '@/lib/rejectReasons'
import { ordinalYear } from '@/lib/ordinal'

// Timeline dot color per actor role (mirrors the shared RequestReviewPanel).
const ROLE_DOT: Record<string, string> = {
  student: '#3b82f6',
  registrar: '#a855f7',
  subject_teacher: '#6366f1',
  program_head: '#f59e0b',
  admin: '#64748b',
}

interface MediaItem {
  id: string
  media_type: string
  storage_path: string
  file_name: string
  mime_type: string
  signed_url?: string
}

interface RequestRow {
  id: string
  exam_type: string
  excused_reason: string | null
  other_reason: string | null
  status: RequestStatus
  submitted_at: string
  resubmitted?: boolean
  final_schedule: string | null
  student: { full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null }
  subject: { subject_code: string; subject_name: string; teacher: { full_name: string } | null }
  media: MediaItem[]
  logs: { id: string; action: string; created_at: string; actor_role: string }[]
}

interface Group {
  key: string
  name: string
  forms: RequestRow[]
}

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

export default function PHQueue({
  requests,
  title = 'Approval Queue',
  emptyText = 'No requests awaiting your approval.',
}: {
  requests: RequestRow[]
  title?: string
  emptyText?: string
}) {
  const reqParam = useSearchParams().get('req')
  const [items, setItems] = useState(requests)
  useEffect(() => setItems(requests), [requests])

  const groups = groupByStudent(items)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const active = groups.find((g) => g.key === selectedKey) ?? null
  const detailRef = useRef<HTMLDivElement>(null)

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!reqParam) return
    const form = requests.find((r) => r.id === reqParam)
    if (form) setSelectedKey(form.student.full_name)
  }, [reqParam, requests])

  useEffect(() => {
    if (selectedKey && typeof window !== 'undefined' && window.innerWidth < 768) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedKey])

  function dropForm(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  // Bulk accept only applies at first approval (approved_by_teacher). The
  // receipts tab has no such rows, so the button never shows there.
  function acceptGroup(g: Group) {
    const ids = g.forms.filter((f) => f.status === 'approved_by_teacher').map((f) => f.id)
    if (!ids.length) return
    setError(null)
    startTransition(async () => {
      const res = await acceptAll(ids)
      if (res.error) setError(res.error)
      else setItems((prev) => prev.filter((r) => !ids.includes(r.id)))
    })
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>{title}</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {groups.length === 0 && (
        <div className="ef-card rounded-xl shadow-sm px-4 py-10 text-center ef-muted">{emptyText}</div>
      )}

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <div className="space-y-2.5">
          {groups.map((g) => {
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
                    {g.forms.length} form{g.forms.length === 1 ? '' : 's'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail — all of the selected student's forms */}
        {groups.length > 0 && (
          <div className="md:sticky md:top-20" ref={detailRef}>
            {active ? (
              <div className="space-y-3">
                {active.forms.filter((f) => f.status === 'approved_by_teacher').length > 1 && (
                  <button
                    onClick={() => acceptGroup(active)}
                    disabled={isPending}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                    style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                  >
                    {isPending ? 'Accepting…' : `Accept all ${active.forms.filter((f) => f.status === 'approved_by_teacher').length} forms`}
                  </button>
                )}
                {active.forms.map((f) => (
                  <div key={f.id} className="ef-card rounded-xl shadow-sm p-6">
                    <p className="text-xs font-semibold uppercase tracking-wide ef-muted mb-2">
                      {f.subject.subject_code} — {f.subject.subject_name}
                    </p>
                    <PHDetail request={f} onDone={() => dropForm(f.id)} />
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

function PHDetail({ request: r, onDone }: { request: RequestRow; onDone: () => void }) {
  const [rejectMode, setRejectMode] = useState<'request' | 'receipt' | null>(null)
  const [reason, setReason] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isExcused = r.exam_type === 'excused'

  function handleExpand(m: MediaItem) {
    const next = expanded === m.id ? null : m.id
    setExpanded(next)
    if (next && !m.signed_url && !urls[m.id]) {
      getSignedUrl(m.storage_path).then((u) => { if (u) setUrls((s) => ({ ...s, [m.id]: u })) })
    }
  }

  // A form with a single document (the common receipt / excuse case) shows it
  // right away — fetch its signed URL on mount so no click is needed. Multi-doc
  // forms keep fetching lazily on View to avoid loading several images at once.
  const soloDoc = r.media.length === 1 ? r.media[0] : null
  useEffect(() => {
    if (soloDoc && !soloDoc.signed_url && !urls[soloDoc.id]) {
      getSignedUrl(soloDoc.storage_path).then((u) => { if (u) setUrls((s) => ({ ...s, [soloDoc.id]: u })) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloDoc?.id])

  // The image / PDF / loading preview body, shared by the solo and expanded views.
  function docPreview(m: MediaItem, url: string | undefined) {
    return (
      <div className="rounded-lg border ef-border overflow-hidden">
        {!url ? (
          <div className="p-2 text-xs ef-muted">Loading…</div>
        ) : m.mime_type.startsWith('image/') ? (
          <div className="relative w-full h-48" style={{ background: 'var(--background)' }}>
            <Image src={url} alt={m.media_type} fill className="object-contain" unoptimized />
          </div>
        ) : (
          <a href={url} target="_blank" rel="noreferrer"
            className="block p-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">Open PDF: {m.file_name}</a>
        )}
      </div>
    )
  }

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptRequest(r.id, '')
      if (res.error) setError(res.error)
      else onDone()
    })
  }

  function handleRejectRequest() {
    if (!reason.trim()) { setError('Reason required'); return }
    startTransition(async () => {
      const res = await rejectPHRequest(r.id, reason)
      if (res.error) setError(res.error)
      else onDone()
    })
  }

  function handleConfirmReceipt() {
    startTransition(async () => {
      const res = await confirmReceipt(r.id)
      if (res.error) setError(res.error)
      else onDone()
    })
  }

  function handleRejectReceipt() {
    if (!reason.trim()) { setError('Reason required'); return }
    startTransition(async () => {
      const res = await rejectReceipt(r.id, reason)
      if (res.error) setError(res.error)
      else onDone()
    })
  }

  return (
    <div className="space-y-4 text-sm">
      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-red-700 text-xs">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Header — subject-code chip + student identity */}
      <div className="flex items-start gap-3">
        <span
          className="w-11 h-11 rounded-xl grid place-items-center font-bold text-sm shrink-0"
          style={{ background: 'var(--sti-navy)', color: 'var(--sti-gold)' }}
        >
          {r.subject.subject_code.slice(0, 3).toUpperCase()}
        </span>
        <div className="min-w-0">
          {/* Subject title is shown by the queue card above — not repeated here. */}
          <h3 className="font-bold text-base leading-tight" style={{ color: 'var(--card-foreground)' }}>{r.student.full_name}</h3>
          {r.student.student_number && <p className="ef-muted text-xs">#{r.student.student_number}</p>}
          <p className="ef-muted text-xs">{r.student.course} · {ordinalYear(r.student.year_level)} · {r.student.section}</p>
          {r.subject.teacher && <p className="ef-muted text-xs mt-0.5">Teacher: {r.subject.teacher.full_name}</p>}
        </div>
      </div>

      {/* Approval chain badges */}
      <div className="flex gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">✓ Registrar verified</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">✓ Teacher approved</span>
      </div>

      {/* Documents */}
      <div>
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2.5 ef-muted">
          <Icon name="file" className="w-3.5 h-3.5" style={{ color: 'var(--sti-gold)' }} /> Documents
        </h4>
        {soloDoc ? (
          // Single document → shown immediately, no View button.
          <div className="space-y-1.5">
            <p className="capitalize font-medium text-xs" style={{ color: 'var(--card-foreground)' }}>{soloDoc.media_type.replace(/_/g, ' ')}</p>
            {docPreview(soloDoc, soloDoc.signed_url ?? urls[soloDoc.id])}
          </div>
        ) : (
        <div className="space-y-2">
          {r.media.map((m) => {
            const url = m.signed_url ?? urls[m.id]
            const open = expanded === m.id
            return (
            <div key={m.id}>
              <button
                onClick={() => handleExpand(m)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border ef-border hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-xs text-left transition-colors"
              >
                <span className="w-6 h-6 rounded-md grid place-items-center shrink-0" style={{ background: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)', color: '#b45309' }}>
                  <Icon name="file" className="w-3.5 h-3.5" />
                </span>
                <span className="capitalize font-medium" style={{ color: 'var(--card-foreground)' }}>{m.media_type.replace(/_/g, ' ')}</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--sti-navy)' }}>{open ? 'Hide' : 'View'}</span>
              </button>
              {open && <div className="mt-1">{docPreview(m, url)}</div>}
            </div>
            )
          })}
        </div>
        )}
      </div>

      {/* History — mini timeline with role-colored dots */}
      <div className="border-t ef-border pt-3">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2.5 ef-muted">
          <Icon name="history" className="w-3.5 h-3.5" style={{ color: 'var(--sti-gold)' }} /> History
        </h4>
        <ol className="space-y-2.5">
          {r.logs.map((l) => (
            <li key={l.id} className="flex gap-2.5 text-xs">
              <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: ROLE_DOT[l.actor_role] ?? '#64748b' }} />
              <div className="min-w-0">
                <p style={{ color: 'var(--card-foreground)' }}>{l.action}</p>
                <p className="ef-muted mt-0.5">{new Date(l.created_at).toLocaleString()}</p>
              </div>
            </li>
          ))}
          {r.logs.length === 0 && <li className="text-xs ef-muted">No activity yet.</li>}
        </ol>
      </div>

      {/* Actions */}
      {r.status === 'approved_by_teacher' && !rejectMode && (
        <div className="space-y-3 border-t ef-border pt-3">
          <button onClick={handleAccept} disabled={isPending}
            className="w-full py-2.5 rounded-lg font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
            {isPending ? 'Processing…' : (<><Icon name="check" className="w-4 h-4" /> {isExcused ? 'Mark scheduled' : 'Accept'}</>)}
          </button>
          {!isExcused && <p className="text-[11px] ef-muted text-center -mt-1">Student uploads the cashier receipt after this.</p>}
          <button onClick={() => setRejectMode('request')}
            className="w-full py-2.5 rounded-lg font-semibold text-sm border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2">
            <Icon name="x" className="w-4 h-4" /> Reject
          </button>
        </div>
      )}

      {r.status === 'receipt_uploaded' && !rejectMode && (
        <div className="space-y-3 border-t ef-border pt-3">
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs" style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)', color: 'var(--card-foreground)' }}>
            <Icon name="receipt" className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#b45309' }} />
            Student has uploaded a payment receipt. Please verify it.
          </div>
          <button onClick={handleConfirmReceipt} disabled={isPending}
            className="w-full py-2.5 rounded-lg font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
            {isPending ? 'Confirming…' : (<><Icon name="check" className="w-4 h-4" /> Confirm Receipt → Mark Scheduled</>)}
          </button>
          <button onClick={() => setRejectMode('receipt')}
            className="w-full py-2.5 rounded-lg font-semibold text-sm border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2">
            <Icon name="x" className="w-4 h-4" /> Reject Receipt
          </button>
        </div>
      )}

      {rejectMode && (
        <div className="space-y-3 border-t ef-border pt-3">
          <RejectReasonPicker
            presets={rejectMode === 'receipt' ? PH_RECEIPT_REJECT : isExcused ? PH_REJECT_EXCUSED : PH_REJECT_PAID}
            onChange={setReason}
          />
          <div className="flex gap-2">
            <button
              onClick={rejectMode === 'receipt' ? handleRejectReceipt : handleRejectRequest}
              disabled={isPending || !reason.trim()}
              className="flex-1 py-2 rounded-lg font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button onClick={() => { setRejectMode(null); setReason('') }}
              className="px-4 py-2 rounded-lg border ef-border text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors" style={{ color: 'var(--card-foreground)' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
