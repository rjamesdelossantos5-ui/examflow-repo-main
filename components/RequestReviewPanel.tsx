'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { getSignedUrl } from '@/app/media-actions'
import RejectReasonPicker from '@/components/RejectReasonPicker'
import { Icon, type IconName } from '@/components/Icon'
import { ordinalYear } from '@/lib/ordinal'
import type { RequestStatus } from '@/lib/supabase/types'

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

// Small gold-accented section header used down the left column.
function SectionLabel({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2.5 ef-muted">
      <Icon name={icon} className="w-3.5 h-3.5" style={{ color: 'var(--sti-gold)' }} />
      {children}
    </h4>
  )
}

export default function RequestReviewPanel({
  requestId,
  studentName,
  studentInfo,
  teacherName,
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
}: Props) {
  const isActionable = status === actionableStatus
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const isPaid = examType === 'paid'

  // Fetch the document's signed URL only when it's actually opened.
  function handleExpand(m: MediaItem) {
    const next = expanded === m.id ? null : m.id
    setExpanded(next)
    if (next && !m.signed_url && !urls[m.id]) {
      getSignedUrl(m.storage_path).then((u) => { if (u) setUrls((s) => ({ ...s, [m.id]: u })) })
    }
  }

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

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left: request info */}
      <div className="space-y-4">
        {/* Header — subject-code chip + student identity */}
        <div className="flex items-start gap-3">
          <span
            className="w-11 h-11 rounded-xl grid place-items-center font-bold text-sm shrink-0"
            style={{ background: 'var(--sti-navy)', color: 'var(--sti-gold)' }}
          >
            {subjectCode.slice(0, 3).toUpperCase()}
          </span>
          <div className="min-w-0">
            {/* Identity only — the subject title is shown by the queue card
                above, and the student's details live in Form Details below, so
                neither is repeated here. */}
            <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--card-foreground)' }}>{studentName}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${isPaid ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'}`}>
                {isPaid ? 'Paid' : 'Excused'}
              </span>
              {excusedReason && (
                <span className="text-xs capitalize ef-muted">{excusedReason}{otherReason ? ` — ${otherReason}` : ''}</span>
              )}
            </div>
          </div>
        </div>

        {/* Form details — what the student filled in (soft gold-tinted panel) */}
        {studentInfo && (
          <div
            className="rounded-xl p-4"
            style={{ background: 'color-mix(in srgb, var(--sti-gold) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--sti-gold) 30%, transparent)' }}
          >
            <SectionLabel icon="list">Form Details</SectionLabel>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {[
                ['Contact No.', studentInfo.contact_number],
                ['Student No.', studentInfo.student_number],
                ['Course', studentInfo.course],
                ['Year', studentInfo.year_level ? ordinalYear(studentInfo.year_level) : null],
                ['Section', studentInfo.section],
                ['Teacher', teacherName],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-[11px] uppercase tracking-wide ef-muted">{label}</dt>
                  <dd className="font-medium" style={{ color: 'var(--card-foreground)' }}>{value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Documents list */}
        {showDocuments && (
        <div>
          <SectionLabel icon="file">Documents</SectionLabel>
          <div className="space-y-2">
            {media.map((m) => {
              const url = m.signed_url ?? urls[m.id]
              const open = expanded === m.id
              return (
              <div key={m.id}>
                <button
                  onClick={() => handleExpand(m)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border ef-border hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-sm text-left transition-colors"
                >
                  <span
                    className="w-7 h-7 rounded-md grid place-items-center shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)', color: '#b45309' }}
                  >
                    <Icon name="file" className="w-4 h-4" />
                  </span>
                  <span className="capitalize font-medium" style={{ color: 'var(--card-foreground)' }}>{m.media_type.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-semibold ml-auto" style={{ color: 'var(--sti-navy)' }}>{open ? 'Hide' : 'View'}</span>
                </button>
                {open && (
                  <div className="mt-1 rounded-lg overflow-hidden border ef-border">
                    {!url ? (
                      <div className="p-3 text-xs ef-muted">Loading…</div>
                    ) : m.mime_type.startsWith('image/') ? (
                      <div className="relative w-full h-64 cursor-zoom-in" style={{ background: 'var(--background)' }}>
                        <Image src={url} alt={m.media_type} fill className="object-contain" unoptimized />
                      </div>
                    ) : (
                      <a href={url} target="_blank" rel="noreferrer"
                        className="block p-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        Open PDF: {m.file_name}
                      </a>
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </div>
        )}

        {/* History — mini timeline with role-colored dots */}
        <div>
          <SectionLabel icon="history">History</SectionLabel>
          <ol className="space-y-2.5">
            {logs.map((l) => (
              <li key={l.id} className="flex gap-2.5 text-xs">
                <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: ROLE_DOT[l.actor_role] ?? '#64748b' }} />
                <div className="min-w-0">
                  <p style={{ color: 'var(--card-foreground)' }}>{l.action}</p>
                  <p className="ef-muted mt-0.5">{new Date(l.created_at).toLocaleString()}</p>
                </div>
              </li>
            ))}
            {logs.length === 0 && <li className="text-xs ef-muted">No activity yet.</li>}
          </ol>
        </div>
      </div>

      {/* Right: actions */}
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
            {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {onVerify && isActionable && !rejectMode && (
          <button
            onClick={handleVerify}
            disabled={isPending}
            className="w-full py-3 rounded-lg font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
          >
            {isPending ? 'Processing…' : (<><Icon name="check" className="w-4 h-4" /> {verifyLabel}</>)}
          </button>
        )}

        {onReject && isActionable && !rejectMode && (
          <button
            onClick={() => setRejectMode(true)}
            className="w-full py-3 rounded-lg font-semibold text-sm border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="x" className="w-4 h-4" /> Reject
          </button>
        )}

        {rejectMode && (
          <div className="space-y-3">
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
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={isPending || !reason.trim()}
                className="flex-1 py-2 rounded-lg font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                {isPending ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button onClick={() => { setRejectMode(false); setReason('') }}
                className="px-4 py-2 rounded-lg border ef-border text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors" style={{ color: 'var(--card-foreground)' }}>Cancel</button>
            </div>
          </div>
        )}

        {status === 'verified_by_registrar' && actionableStatus === 'submitted' && (
          <div className="flex items-center gap-2 rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-300">
            <Icon name="check" className="w-4 h-4 shrink-0" /> Verified — forwarded to Subject Teacher
          </div>
        )}

        {status === 'rejected' && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
            <Icon name="x" className="w-4 h-4 shrink-0" /> Rejected
          </div>
        )}
      </div>
    </div>
  )
}
