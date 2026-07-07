'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { getSignedUrl } from '@/app/media-actions'
import RejectReasonPicker from '@/components/RejectReasonPicker'
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
}: Props) {
  const isActionable = status === actionableStatus
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

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
        <div>
          <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>{studentName}</h3>
          {studentInfo?.student_number && <p className="text-xs text-gray-400">#{studentInfo.student_number}</p>}
          {(studentInfo?.course || studentInfo?.year_level) && (
            <p className="text-sm text-gray-500">
              {studentInfo?.course}{studentInfo?.course && studentInfo?.year_level ? ' · ' : ''}
              {studentInfo?.year_level ? ordinalYear(studentInfo.year_level) : ''}
              {studentInfo?.section ? ` · ${studentInfo.section}` : ''}
            </p>
          )}
          <p className="mt-1 text-sm ef-muted">{subjectCode} — {subjectName}</p>
          <div className="flex gap-3 mt-2 text-sm">
            <span className={`px-2 py-0.5 rounded font-semibold text-xs ${examType === 'paid' ? 'bg-yellow-50 text-yellow-700' : 'bg-teal-50 text-teal-700'}`}>
              {examType === 'paid' ? 'Paid' : 'Excused'}
            </span>
            {excusedReason && (
              <span className="text-gray-600 capitalize">{excusedReason}{otherReason ? ` — ${otherReason}` : ''}</span>
            )}
          </div>
        </div>

        {/* Form details — what the student filled in */}
        {studentInfo && (
          <div className="rounded-xl border ef-border p-3.5">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2.5">Form Details</h4>
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
                  <dt className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</dt>
                  <dd className="font-medium" style={{ color: 'var(--card-foreground)' }}>{value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Documents list */}
        {showDocuments && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Documents</h4>
          <div className="space-y-2">
            {media.map((m) => {
              const url = m.signed_url ?? urls[m.id]
              return (
              <div key={m.id}>
                <button
                  onClick={() => handleExpand(m)}
                  className="w-full flex items-center gap-2 p-2 rounded border hover:bg-gray-50 text-sm text-left"
                >
                  <span className="capitalize font-medium">{m.media_type.replace(/_/g, ' ')}</span>
                  <span className="text-gray-400 text-xs ml-auto">{expanded === m.id ? '▲ hide' : '▼ view'}</span>
                </button>
                {expanded === m.id && (
                  <div className="mt-1 rounded overflow-hidden border">
                    {!url ? (
                      <div className="p-3 text-xs text-gray-400">Loading…</div>
                    ) : m.mime_type.startsWith('image/') ? (
                      <div className="relative w-full h-64 cursor-zoom-in">
                        <Image src={url} alt={m.media_type} fill className="object-contain" unoptimized />
                      </div>
                    ) : (
                      <a href={url} target="_blank" rel="noreferrer"
                        className="block p-3 text-sm text-blue-600 hover:underline">
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

        {/* History */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">History</h4>
          <ol className="space-y-1 text-xs">
            {logs.map((l) => (
              <li key={l.id} className="text-gray-600">
                <span className="text-gray-400">{new Date(l.created_at).toLocaleString()} · </span>
                {l.action}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Right: actions */}
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {onVerify && isActionable && !rejectMode && (
          <button
            onClick={handleVerify}
            disabled={isPending}
            className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
          >
            {isPending ? 'Processing…' : verifyLabel}
          </button>
        )}

        {onReject && isActionable && !rejectMode && (
          <button
            onClick={() => setRejectMode(true)}
            className="w-full py-3 rounded-lg font-semibold text-sm border border-red-300 text-red-600 hover:bg-red-50"
          >
            Reject
          </button>
        )}

        {rejectMode && (
          <div className="space-y-3">
            {rejectPresets ? (
              <RejectReasonPicker presets={rejectPresets} onChange={setReason} />
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700">Rejection reason *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  placeholder="Explain why the request is rejected…"
                />
              </>
            )}
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={isPending || !reason.trim()}
                className="flex-1 py-2 rounded-lg font-semibold text-sm bg-red-600 text-white disabled:opacity-50">
                {isPending ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button onClick={() => { setRejectMode(false); setReason('') }}
                className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            </div>
          </div>
        )}

        {status === 'verified_by_registrar' && actionableStatus === 'submitted' && (
          <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-700">
            ✓ Verified — forwarded to Subject Teacher
          </div>
        )}

        {status === 'rejected' && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            ✗ Rejected
          </div>
        )}
      </div>
    </div>
  )
}
