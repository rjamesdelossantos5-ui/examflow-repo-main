'use client'

import { useErrorToast } from '@/components/Toaster'
import { useState, useEffect, useTransition } from 'react'
import DocumentViewer from '@/components/DocumentViewer'
import { getSignedUrl } from '@/app/media-actions'
import RejectReasonPicker from '@/components/RejectReasonPicker'
import { Icon, type IconName } from '@/components/Icon'
import { ordinalYear } from '@/lib/ordinal'
import type { RequestStatus } from '@/lib/supabase/types'
import type { ParentCheck } from '@/lib/didit'
import ParentNameCheck from '@/components/ParentNameCheck'
import { shownInHistory } from '@/lib/historyFilter'

interface MediaItem {
  id: string
  media_type: string
  storage_path: string
  file_name: string
  mime_type: string
  signed_url?: string
}

interface StudentInfo {
  contact_number?: string | null
  student_number?: string | null
  course?: string | null
  year_level?: number | null
  section?: string | null
}

interface Props {
  requestId: string
  studentName: string
  studentInfo?: StudentInfo
  teacherName?: string | null
  subjectName: string
  subjectCode: string
  examType: string
  excusedReason?: string | null
  otherReason?: string | null
  status: RequestStatus
  media: MediaItem[]
  logs: { id: string; action: string; created_at: string; actor_role: string }[]
  onVerify?: (id: string) => Promise<{ error: string | null }>
  onReject?: (id: string, reason: string) => Promise<{ error: string | null }>
  verifyLabel?: string
  /** The status at which THIS reviewer can act. Registrar = 'submitted', Teacher = 'verified_by_registrar'. */
  actionableStatus?: RequestStatus
  showRejectedBy?: string
  /** Teachers don't verify the parent documents, so hide that section for them. */
  showDocuments?: boolean
  /** Quick-pick rejection reasons; picking "Other" reveals a text box. */
  rejectPresets?: string[]
  /** Fired after a successful verify/reject so the queue can drop the card instantly. */
  onDone?: () => void
  /** Didit parent identity result. Omit to hide the section entirely — a request
   *  submitted before this feature existed simply has nothing to show. */
  verification?: VerificationProps
  /** The name on the parent's ID against the Registrar's parent list (Registrar only). */
  parentCheck?: ParentCheck | null
}

interface VerificationProps {
  status: string | null
  livenessScore: number | null
  faceMatchScore: number | null
  documentType: string | null
}

/**
 * One-line summary of the parent identity check: an icon and a coloured
 * verdict, then the scores in muted text. No tinted box; colour marks only
 * the verdict.
 *
 * Statuses are matched case-insensitively on purpose: Didit's own documentation
 * spells the same value both "Kyc Expired" and "KYC Expired", so an exact match
 * would silently fall through to the default on the real value.
 */
function VerificationLine({ status, livenessScore, faceMatchScore, documentType }: VerificationProps) {
  const s = (status ?? '').trim().toLowerCase()
  const tone: { icon: IconName; color: string; label: string } =
    s === 'approved' ? { icon: 'shield-check', color: 'var(--status-success)', label: 'Verified' }
    : s === 'declined' ? { icon: 'x-circle', color: 'var(--status-danger)', label: 'Failed' }
    : s === 'in review' ? { icon: 'clock', color: 'var(--status-warning)', label: 'Under review' }
    : !s || s === 'not started' ? { icon: 'clock', color: 'var(--muted)', label: 'Not verified yet' }
    : { icon: 'clock', color: 'var(--status-info)', label: 'In progress' }

  const facts = [
    documentType,
    livenessScore != null ? `live selfie check ${livenessScore}` : null,
    faceMatchScore != null ? `face match ${faceMatchScore}` : null,
  ].filter(Boolean)

  return (
    <div className="flex gap-2.5 text-sm">
      <Icon name={tone.icon} className="w-4 h-4 mt-0.5 shrink-0" style={{ color: tone.color }} />
      <div className="min-w-0 space-y-1">
        <p>
          <span className="font-semibold" style={{ color: tone.color }}>{tone.label}</span>
          {facts.length > 0 && <span style={{ color: 'var(--card-foreground)' }}>: {facts.join(', ')}</span>}
        </p>
        {s === 'approved' && (
          <p className="text-xs ef-muted">The person present matched the ID they scanned.</p>
        )}
      </div>
    </div>
  )
}

// Timeline dot color per actor role — a small, consistent splash of color that
// makes the history readable at a glance (who did what).
const ROLE_DOT: Record<string, string> = {
  student: '#3b82f6',
  registrar: '#a855f7',
  subject_teacher: '#6366f1',
  program_head: '#f59e0b',
  admin: '#64748b',
}

// A section's title: sentence case, quiet, with a hairline above the section.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-5 mt-5 border-t ef-border">
      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--card-foreground)' }}>{title}</h4>
      {children}
    </section>
  )
}

export default function RequestReviewPanel({
  requestId,
  studentName,
  studentInfo,
  teacherName,
  subjectName,
  subjectCode,
  examType,
  excusedReason,
  otherReason,
  status,
  media,
  logs,
  onVerify,
  onReject,
  verifyLabel = 'Verify & Forward',
  actionableStatus = 'submitted',
  showDocuments = true,
  rejectPresets,
  onDone,
  verification,
  parentCheck,
}: Props) {
  const isActionable = status === actionableStatus
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const isPaid = examType === 'paid'

  // Every document shows inline right away (no "View" click) as a clickable
  // thumbnail that zooms. The bucket is private, so we sign each file's URL on
  // mount — short-lived signed URLs, fetched only for the docs actually shown.
  useEffect(() => {
    for (const m of media) {
      if (!m.signed_url && !urls[m.id]) {
        getSignedUrl(m.storage_path).then((u) => { if (u) setUrls((s) => ({ ...s, [m.id]: u })) })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shownLogs = logs.filter((l) => shownInHistory(l.action))
  const viewerMedia = media.map((m) => ({
    id: m.id,
    media_type: m.media_type,
    file_name: m.file_name,
    mime_type: m.mime_type,
    signed_url: m.signed_url ?? urls[m.id],
  }))

  function handleVerify() {
    if (!onVerify) return
    startTransition(async () => {
      const res = await onVerify(requestId)
      if (res.error) setError(res.error)
      else onDone?.()
    })
  }

  function handleReject() {
    if (!onReject) return
    if (!reason.trim()) { setError('Please choose or enter a rejection reason'); return }
    startTransition(async () => {
      const res = await onReject(requestId, reason)
      if (res.error) setError(res.error)
      else { setRejectMode(false); onDone?.() }
    })
  }

  const canAct = isActionable && !rejectMode
  const reasonText = excusedReason ? `${excusedReason}${otherReason ? `: ${otherReason}` : ''}` : null

  return (
    <div>
      {/* ── Header: who and what, with the decision at the right ── */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight" style={{ color: 'var(--card-foreground)' }}>{studentName}</h3>
          <p className="mt-1 text-sm ef-muted">
            <span className="font-semibold" style={{ color: 'var(--card-foreground)' }}>{subjectCode}</span> {subjectName}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{
                background: `color-mix(in srgb, ${isPaid ? 'var(--status-warning)' : 'var(--status-info)'} 14%, transparent)`,
                color: isPaid ? 'var(--status-warning)' : 'var(--status-info)',
              }}
            >
              {isPaid ? 'Paid' : 'Excused'}
            </span>
            {reasonText && <span className="text-xs capitalize ef-muted">{reasonText}</span>}
          </div>
        </div>

        {/* Actions, or the outcome once acted on */}
        <div className="flex flex-wrap items-center gap-2">
          {onReject && canAct && (
            <button
              onClick={() => setRejectMode(true)}
              className="ef-press px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              style={{ color: 'var(--status-danger)', border: '1px solid color-mix(in srgb, var(--status-danger) 40%, transparent)' }}
            >
              Reject
            </button>
          )}
          {onVerify && canAct && (
            <button
              onClick={handleVerify}
              disabled={isPending}
              className="ef-press px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              <Icon name="check" className="w-4 h-4" />
              {isPending ? 'Processing…' : verifyLabel}
            </button>
          )}
          {status === 'verified_by_registrar' && actionableStatus === 'submitted' && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--status-success)' }}>
              <Icon name="check" className="w-4 h-4" /> Verified, sent to the teacher
            </span>
          )}
          {status === 'rejected' && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--status-danger)' }}>
              <Icon name="x-circle" className="w-4 h-4" /> Rejected
            </span>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--status-danger)' }}>
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </p>
      )}

      {/* Reject: the reason, full width under the header */}
      {rejectMode && (
        <div className="mt-4 space-y-3 rounded-lg p-4" style={{ border: '1px solid var(--border)' }}>
          {rejectPresets ? (
            <RejectReasonPicker presets={rejectPresets} onChange={setReason} />
          ) : (
            <>
              <label className="block text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>Rejection reason *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full border ef-border rounded-lg px-3 py-2 text-sm resize-none bg-transparent focus:outline-none focus:ring-2 focus:ring-red-400"
                style={{ color: 'var(--card-foreground)' }}
                placeholder="Explain why the request is rejected…"
              />
            </>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setRejectMode(false); setReason('') }}
              className="px-4 py-2 rounded-lg border ef-border text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors" style={{ color: 'var(--card-foreground)' }}>
              Cancel
            </button>
            <button onClick={handleReject} disabled={isPending || !reason.trim()}
              className="ef-press px-4 py-2 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--status-danger)' }}>
              {isPending ? 'Rejecting…' : 'Confirm reject'}
            </button>
          </div>
        </div>
      )}

      {/* ── Form details ── */}
      {studentInfo && (
        <Section title="Form details">
          <dl className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {[
              ['Student no.', studentInfo.student_number],
              ['Course', studentInfo.course],
              ['Year', studentInfo.year_level ? ordinalYear(studentInfo.year_level) : null],
              ['Section', studentInfo.section],
              ['Teacher', teacherName],
              ['Contact no.', studentInfo.contact_number],
            ].map(([label, value]) => (
              <div key={label as string} className="min-w-0">
                <dt className="text-xs ef-muted">{label}</dt>
                <dd className="font-medium break-words tabular-nums" style={{ color: 'var(--card-foreground)' }}>{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* ── Parent identity check ──
          Replaces reading the parent's ID by eye. The outcome and scores are
          shown; the ID image and selfie are never stored here (see
          supabase/migration_didit.sql). The name read off the ID is shown only
          beside the Registrar's parent list (parentCheck), because comparing
          the two is the Registrar's check. */}
      {verification && (
        <Section title="Parent check">
          <div className="space-y-3">
            <VerificationLine {...verification} />
            {parentCheck && <ParentNameCheck check={parentCheck} />}
          </div>
        </Section>
      )}

      {/* ── Documents ── inline, clickable thumbnails (click to zoom). Left out
          when there are none: only an excused request has a supporting document. */}
      {showDocuments && viewerMedia.length > 0 && (
        <Section title="Documents">
          <DocumentViewer media={viewerMedia} />
        </Section>
      )}

      {/* ── History ── collapsed until opened, so the review stays on the decision. */}
      <details className="group pt-5 mt-5 border-t ef-border">
        <summary className="list-none cursor-pointer select-none inline-flex items-center gap-1.5 text-sm font-semibold [&::-webkit-details-marker]:hidden" style={{ color: 'var(--card-foreground)' }}>
          History <span className="font-normal ef-muted">({shownLogs.length})</span>
          <Icon name="chevron-down" className="w-4 h-4 ef-muted transition-transform group-open:rotate-180" />
        </summary>
        <ol className="space-y-2.5 mt-3">
          {shownLogs.map((l) => (
            <li key={l.id} className="flex gap-2.5 text-xs">
              <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: ROLE_DOT[l.actor_role] ?? '#64748b' }} />
              <div className="min-w-0">
                {/* The admin can take any role's step; the log text names the
                    role's step, so say who actually did it. */}
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
