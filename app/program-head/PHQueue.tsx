'use client'

import { useErrorToast } from '@/components/Toaster'
import { useState, useEffect, useRef, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import DocumentViewer from '@/components/DocumentViewer'
import MarkViewed from '@/components/MarkViewed'
import type { RequestStatus } from '@/lib/supabase/types'
import type { ParentCheck } from '@/lib/didit'
import ParentNameCheck from '@/components/ParentNameCheck'
import { acceptRequest, rejectPHRequest, confirmReceipt, rejectReceipt, acceptAll, returnForReverification, getVerificationPhotos } from './actions'
import { Icon } from '@/components/Icon'
import { getSignedUrl } from '@/app/media-actions'
import RejectReasonPicker from '@/components/RejectReasonPicker'
import { PH_REJECT_EXCUSED, PH_REJECT_PAID, PH_RECEIPT_REJECT, PH_REVERIFY } from '@/lib/rejectReasons'
import { verificationPhotoSrc, type VerificationPhoto } from '@/lib/verificationPhotos'
import { ordinalYear } from '@/lib/ordinal'
import { shownInHistory } from '@/lib/historyFilter'

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
  /** Set when this request was returned for re-verification and has come back:
   *  the reason the Program Head gave last time. */
  reverifyReason?: string | null
  /** Didit's result for the parent. Null for a request submitted before parent
   *  verification existed — there are no photos to review. */
  verification?: {
    faceMatchScore: number | null
    livenessScore: number | null
    idName: string | null
    /** The name on the ID against the Registrar's parent list. */
    parentCheck?: ParentCheck | null
  } | null
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
  useErrorToast(error)
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
      {/* Opening a student shows all their forms, so all count as viewed. */}
      <MarkViewed ids={active?.forms.map((f) => f.id) ?? []} />
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>{title}</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {groups.length === 0 && (
        <div className="ef-card rounded-xl shadow-sm px-4 py-10 text-center ef-muted">{emptyText}</div>
      )}

      {/* A narrow list and a wide review, the same as the Teacher's
          page. */}
      <div className="grid md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
        <div className={`ef-card rounded-xl shadow-sm overflow-hidden divide-y ef-border ${groups.length === 0 ? 'hidden' : ''}`}>
          {groups.map((g) => {
            const anyResub = g.forms.some((f) => f.resubmitted)
            const anyReverified = g.forms.some((f) => f.reverifyReason)
            const selected = selectedKey === g.key
            return (
              <button
                key={g.key}
                onClick={() => setSelectedKey(g.key === selectedKey ? null : g.key)}
                aria-current={selected ? 'true' : undefined}
                className="w-full text-left px-4 py-3.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                style={selected ? { background: 'color-mix(in srgb, var(--sti-gold) 14%, transparent)' } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate flex items-center gap-2" style={{ color: 'var(--card-foreground)' }}>
                      {g.name}
                      {anyResub && <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-blue-100 text-blue-700">Resubmitted</span>}
                      {anyReverified && <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-100 text-amber-800">Re-verified</span>}
                    </p>
                    <p className="text-sm ef-muted truncate">{g.forms.map((f) => f.subject.subject_name).join(', ')}</p>
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
                  <div key={f.id} className="ef-card rounded-xl shadow-sm p-5 sm:p-6">
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
  // 'reverify' = return for re-verification: same reason picker, different action.
  const [rejectMode, setRejectMode] = useState<'request' | 'receipt' | 'reverify' | null>(null)
  const [reason, setReason] = useState('')
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)
  const [isPending, startTransition] = useTransition()

  const isExcused = r.exam_type === 'excused'

  // Every uploaded document (certificate / receipt) shows inline right away as
  // a clickable thumbnail that zooms — no "View" click. The bucket is private,
  // so sign each file's URL on mount (short-lived signed URLs).
  useEffect(() => {
    for (const m of r.media) {
      if (!m.signed_url && !urls[m.id]) {
        getSignedUrl(m.storage_path).then((u) => { if (u) setUrls((s) => ({ ...s, [m.id]: u })) })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shownLogs = r.logs.filter((l) => shownInHistory(l.action))
  const viewerMedia = r.media.map((m) => ({
    id: m.id,
    media_type: m.media_type,
    file_name: m.file_name,
    mime_type: m.mime_type,
    signed_url: m.signed_url ?? urls[m.id],
  }))

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

  function handleReturn() {
    if (!reason.trim()) { setError('Reason required'); return }
    startTransition(async () => {
      const res = await returnForReverification(r.id, reason)
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

  const firstApproval = r.status === 'approved_by_teacher' && !rejectMode
  const receiptCheck = r.status === 'receipt_uploaded' && !rejectMode
  const outlineBtn = 'ef-press px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] inline-flex items-center gap-2'
  const primaryBtn = 'ef-press px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2'
  const dangerBorder = { color: 'var(--status-danger)', border: '1px solid color-mix(in srgb, var(--status-danger) 40%, transparent)' }

  return (
    <div className="text-sm">
      {/* ── Header: who and what, with the decision at the right ── */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight break-words" style={{ color: 'var(--card-foreground)' }}>{r.student.full_name}</h3>
          <p className="mt-1 ef-muted">
            {r.subject.subject_name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs ef-muted -mr-1.5">Exam type:</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{
                background: `color-mix(in srgb, ${isExcused ? 'var(--status-info)' : 'var(--status-warning)'} 14%, transparent)`,
                color: isExcused ? 'var(--status-info)' : 'var(--status-warning)',
              }}
            >
              {isExcused ? 'Waived' : 'Paid'}
            </span>
            {/* The signature already on it */}
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--status-success)' }}>
              <Icon name="check" className="w-3.5 h-3.5" /> Teacher approved
            </span>
          </div>
        </div>

        {(firstApproval || receiptCheck) && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              {firstApproval && (
                <>
                  <button onClick={() => setRejectMode('request')} className={outlineBtn} style={dangerBorder}>Reject</button>
                  {r.verification && (
                    <button onClick={() => setRejectMode('reverify')} className={outlineBtn}
                      style={{ color: 'var(--status-warning)', border: '1px solid color-mix(in srgb, var(--status-warning) 40%, transparent)' }}>
                      Return for re-verification
                    </button>
                  )}
                  <button onClick={handleAccept} disabled={isPending} className={primaryBtn}
                    style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
                    <Icon name="check" className="w-4 h-4" />
                    {isPending ? 'Processing…' : isExcused ? 'Mark scheduled' : 'Accept'}
                  </button>
                </>
              )}
              {receiptCheck && (
                <>
                  <button onClick={() => setRejectMode('receipt')} className={outlineBtn} style={dangerBorder}>Reject receipt</button>
                  <button onClick={handleConfirmReceipt} disabled={isPending} className={primaryBtn}
                    style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
                    <Icon name="check" className="w-4 h-4" />
                    {isPending ? 'Confirming…' : 'Confirm receipt and schedule'}
                  </button>
                </>
              )}
            </div>
            {firstApproval && (!isExcused || r.verification) && (
              <p className="text-xs ef-muted text-right max-w-[46ch]">
                {!isExcused && 'The student uploads the cashier receipt after this. '}
                {r.verification && 'The parent’s ID and selfie photos are deleted when you accept.'}
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--status-danger)' }}>
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </p>
      )}

      {/* Back after a return for re-verification: say what to look at again. */}
      {r.status === 'approved_by_teacher' && r.reverifyReason && (
        <p className="mt-4 flex gap-2.5">
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--status-warning)' }} />
          <span style={{ color: 'var(--card-foreground)' }}>
            <strong>Re-verified.</strong> You returned this before: &ldquo;{r.reverifyReason}&rdquo;. The parent has verified again, so check the new photos.
          </span>
        </p>
      )}

      {r.status === 'receipt_uploaded' && (
        <p className="mt-4 flex gap-2.5" style={{ color: 'var(--card-foreground)' }}>
          <Icon name="receipt" className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--status-warning)' }} />
          The student uploaded a payment receipt. Check it below.
        </p>
      )}

      {rejectMode && (
        <div className="mt-4 space-y-3 rounded-lg p-4" style={{ border: '1px solid var(--border)' }}>
          {rejectMode === 'reverify' && (
            <p className="text-xs ef-muted">
              The parent or guardian verifies again, and the request comes straight back to you — not to
              the Teacher. These photos are deleted.
            </p>
          )}
          <RejectReasonPicker
            presets={rejectMode === 'reverify' ? PH_REVERIFY : rejectMode === 'receipt' ? PH_RECEIPT_REJECT : isExcused ? PH_REJECT_EXCUSED : PH_REJECT_PAID}
            onChange={setReason}
            label={rejectMode === 'reverify' ? 'Reason for returning' : undefined}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setRejectMode(null); setReason('') }}
              className="px-4 py-2 rounded-lg border ef-border text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors" style={{ color: 'var(--card-foreground)' }}>Cancel</button>
            <button
              onClick={rejectMode === 'reverify' ? handleReturn : rejectMode === 'receipt' ? handleRejectReceipt : handleRejectRequest}
              disabled={isPending || !reason.trim()}
              className="ef-press px-4 py-2 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: rejectMode === 'reverify' ? '#b45309' : 'var(--status-danger)' }}
            >
              {rejectMode === 'reverify'
                ? (isPending ? 'Returning…' : 'Return to student')
                : (isPending ? 'Rejecting…' : 'Confirm reject')}
            </button>
          </div>
        </div>
      )}

      {/* ── Form details ── */}
      <PHSection title="Form details">
        <dl className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
          {[
            ['Student no.', r.student.student_number],
            ['Course', r.student.course],
            ['Year', r.student.year_level ? ordinalYear(r.student.year_level) : null],
            ['Section', r.student.section],
            ['Teacher', r.subject.teacher?.full_name],
            ...(r.excused_reason ? [['Reason', `${r.excused_reason}${r.other_reason ? `: ${r.other_reason}` : ''}`]] : []),
          ].map(([label, value]) => (
            <div key={label as string} className="min-w-0">
              <dt className="text-xs ef-muted">{label}</dt>
              <dd className="font-medium break-words tabular-nums first-letter:uppercase" style={{ color: 'var(--card-foreground)' }}>{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </PHSection>

      {/* The parent's ID and selfie — the Program Head's manual check at first approval. */}
      {r.status === 'approved_by_teacher' && <ParentPhotos requestId={r.id} verification={r.verification ?? null} />}

      {/* Documents — left out when there are none (only an excused request
          has a supporting document; a paid one gets its receipt here). */}
      {viewerMedia.length > 0 && (
        <PHSection title="Documents">
          <DocumentViewer media={viewerMedia} />
        </PHSection>
      )}

      {/* History — collapsed until opened, so the review stays on the decision. */}
      <details className="group pt-5 mt-5 border-t ef-border">
        <summary className="list-none cursor-pointer select-none inline-flex items-center gap-1.5 font-semibold [&::-webkit-details-marker]:hidden" style={{ color: 'var(--card-foreground)' }}>
          History <span className="font-normal ef-muted">({shownLogs.length})</span>
          <Icon name="chevron-down" className="w-4 h-4 ef-muted transition-transform group-open:rotate-180" />
        </summary>
        <ol className="space-y-2.5 mt-3">
          {shownLogs.map((l) => (
            <li key={l.id} className="flex gap-2.5 text-xs">
              <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: ROLE_DOT[l.actor_role] ?? '#64748b' }} />
              <div className="min-w-0">
                <p style={{ color: 'var(--card-foreground)' }}>{l.action}{l.actor_role === 'admin' && ' (by Admin)'}</p>
                <p className="ef-muted mt-0.5">{new Date(l.created_at).toLocaleString()}</p>
              </div>
            </li>
          ))}
          {shownLogs.length === 0 && <li className="text-xs ef-muted">No activity yet.</li>}
        </ol>
      </details>
    </div>
  )
}

// A section's title: sentence case, quiet, with a hairline above the section.
// Same as the Teacher review panel's, so the roles match.
function PHSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-5 mt-5 border-t ef-border">
      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--card-foreground)' }}>{title}</h4>
      {children}
    </section>
  )
}

/**
 * The parent's ID and live selfie, for the Program Head's manual check at first
 * approval. EXAMFLOW stores none of these: getVerificationPhotos asks Didit
 * which photos this verification has, and each image is streamed through
 * /program-head/verification-photo, which re-checks access on every load.
 */
function ParentPhotos({ requestId, verification }: { requestId: string; verification: RequestRow['verification'] | null }) {
  const [photos, setPhotos] = useState<VerificationPhoto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)
  const hasVerification = !!verification

  useEffect(() => {
    if (!hasVerification) return
    let cancelled = false
    getVerificationPhotos(requestId).then((res) => {
      if (cancelled) return
      if (res.error) setError(res.error)
      else setPhotos(res.photos)
    })
    return () => { cancelled = true }
  }, [requestId, hasVerification])

  const scores = verification
    ? [
        verification.faceMatchScore != null ? `face match ${verification.faceMatchScore}` : null,
        verification.livenessScore != null ? `live selfie check ${verification.livenessScore}` : null,
      ].filter(Boolean).join(' · ')
    : ''

  return (
    <PHSection title="Parent check">
      {!verification ? (
        <p className="text-xs ef-muted">No photos: this request was submitted before parent verification existed.</p>
      ) : (
        <>
          <p className="mb-3" style={{ color: 'var(--card-foreground)' }}>
            Compare the face on the ID with the live selfie, and the name with the student&apos;s records.
            {!verification.parentCheck && verification.idName && <> Name on the ID: <strong>{verification.idName}</strong>.</>}
            {scores && <span className="ef-muted"> Didit: {scores}.</span>}
          </p>
          {verification.parentCheck && (
            <div className="mb-4">
              <ParentNameCheck check={verification.parentCheck} />
            </div>
          )}
          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : photos === null ? (
            <p className="text-xs ef-muted">Loading photos…</p>
          ) : photos.length === 0 ? (
            <p className="text-xs ef-muted">Didit returned no photos for this verification.</p>
          ) : (
            <DocumentViewer
              media={photos.map((p) => ({
                id: p,
                media_type: p,
                file_name: `${p}.jpg`,
                mime_type: 'image/jpeg',
                signed_url: verificationPhotoSrc(requestId, p),
              }))}
            />
          )}
        </>
      )}
    </PHSection>
  )
}
