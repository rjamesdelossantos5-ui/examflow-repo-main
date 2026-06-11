'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import type { RequestStatus } from '@/lib/supabase/types'
import { acceptRequest, rejectPHRequest, confirmReceipt, rejectReceipt } from './actions'
import StatusBadge from '@/components/StatusBadge'

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
  final_schedule: string | null
  student: { full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null }
  subject: { subject_code: string; subject_name: string; teacher: { full_name: string } | null }
  media: MediaItem[]
  logs: { id: string; action: string; created_at: string; actor_role: string }[]
}

export default function PHQueue({ requests }: { requests: RequestRow[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const active = requests.find((r) => r.id === selected) ?? null

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Approval Queue</h2>

      {requests.length === 0 && (
        <div className="bg-white rounded-xl shadow px-4 py-10 text-center text-gray-400">
          No requests awaiting your approval.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id === selected ? null : r.id)}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${
                selected === r.id ? 'border-[var(--sti-gold)] bg-yellow-50' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{r.student.full_name}</p>
                  <p className="text-sm text-gray-500">{r.subject.subject_code} — {r.subject.subject_name}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.exam_type === 'paid' ? 'bg-yellow-50 text-yellow-700' : 'bg-teal-50 text-teal-700'}`}>
                    {r.exam_type === 'paid' ? 'Paid' : 'Excused'}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{new Date(r.submitted_at).toLocaleDateString()}</p>
            </button>
          ))}
        </div>

        {active && (
          <div className="bg-white rounded-xl shadow p-6">
            <PHDetail request={active} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  )
}

function PHDetail({ request: r, onClose }: { request: RequestRow; onClose: () => void }) {
  const [rejectMode, setRejectMode] = useState<'request' | 'receipt' | null>(null)
  const [reason, setReason] = useState('')
  const [schedule, setSchedule] = useState(r.final_schedule ? r.final_schedule.slice(0, 16) : '')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptRequest(r.id, schedule)
      if (res.error) setError(res.error)
      else onClose()
    })
  }

  function handleRejectRequest() {
    if (!reason.trim()) { setError('Reason required'); return }
    startTransition(async () => {
      const res = await rejectPHRequest(r.id, reason)
      if (res.error) setError(res.error)
      else onClose()
    })
  }

  function handleConfirmReceipt() {
    startTransition(async () => {
      const res = await confirmReceipt(r.id)
      if (res.error) setError(res.error)
      else onClose()
    })
  }

  function handleRejectReceipt() {
    if (!reason.trim()) { setError('Reason required'); return }
    startTransition(async () => {
      const res = await rejectReceipt(r.id, reason)
      if (res.error) setError(res.error)
      else onClose()
    })
  }

  return (
    <div className="space-y-4 text-sm">
      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-red-700 text-xs">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div>
        <h3 className="font-bold text-base" style={{ color: 'var(--sti-navy)' }}>{r.student.full_name}</h3>
        {r.student.student_number && <p className="text-gray-400 text-xs">#{r.student.student_number}</p>}
        <p className="text-gray-500 text-xs">{r.student.course} · Year {r.student.year_level} · {r.student.section}</p>
        <p className="mt-1">{r.subject.subject_code} — {r.subject.subject_name}</p>
        {r.subject.teacher && <p className="text-gray-400 text-xs">Teacher: {r.subject.teacher.full_name}</p>}
      </div>

      {/* Approval chain badges */}
      <div className="flex gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">✓ Registrar verified</span>
        <span className="px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700">✓ Teacher approved</span>
      </div>

      {/* Documents */}
      <div className="space-y-2">
        {r.media.map((m) => (
          <div key={m.id}>
            <button
              onClick={() => setExpanded(expanded === m.id ? null : m.id)}
              className="w-full flex items-center gap-2 p-2 rounded border hover:bg-gray-50 text-xs text-left"
            >
              <span className="capitalize font-medium">{m.media_type.replace(/_/g, ' ')}</span>
              <span className="ml-auto text-gray-400">{expanded === m.id ? '▲' : '▼'}</span>
            </button>
            {expanded === m.id && m.signed_url && (
              <div className="mt-1 rounded border overflow-hidden">
                {m.mime_type.startsWith('image/') ? (
                  <div className="relative w-full h-48">
                    <Image src={m.signed_url} alt={m.media_type} fill className="object-contain" unoptimized />
                  </div>
                ) : (
                  <a href={m.signed_url} target="_blank" rel="noreferrer"
                    className="block p-2 text-xs text-blue-600 hover:underline">Open PDF: {m.file_name}</a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* History */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">History</p>
        {r.logs.map((l) => (
          <p key={l.id} className="text-xs text-gray-500">{new Date(l.created_at).toLocaleString()} — {l.action}</p>
        ))}
      </div>

      {/* Actions */}
      {r.status === 'approved_by_teacher' && !rejectMode && (
        <div className="space-y-3 border-t pt-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Set Exam Schedule (optional)</label>
            <input
              type="datetime-local"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-xs"
            />
          </div>
          <button onClick={handleAccept} disabled={isPending}
            className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
            {isPending ? 'Accepting…' : r.exam_type === 'excused' ? 'Accept' : 'Accept (await receipt)'}
          </button>
          <button onClick={() => setRejectMode('request')}
            className="w-full py-2.5 rounded-lg font-semibold text-sm border border-red-300 text-red-600 hover:bg-red-50">
            Reject
          </button>
        </div>
      )}

      {r.status === 'receipt_uploaded' && !rejectMode && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs text-gray-600">Student has uploaded a payment receipt. Please verify it.</p>
          <button onClick={handleConfirmReceipt} disabled={isPending}
            className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
            {isPending ? 'Confirming…' : 'Confirm Receipt → Mark Scheduled'}
          </button>
          <button onClick={() => setRejectMode('receipt')}
            className="w-full py-2.5 rounded-lg font-semibold text-sm border border-red-300 text-red-600 hover:bg-red-50">
            Reject Receipt
          </button>
        </div>
      )}

      {rejectMode && (
        <div className="space-y-3 border-t pt-3">
          <label className="block text-xs font-medium text-gray-600">Rejection reason *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full border rounded px-3 py-2 text-sm resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={rejectMode === 'receipt' ? handleRejectReceipt : handleRejectRequest}
              disabled={isPending || !reason.trim()}
              className="flex-1 py-2 rounded-lg font-semibold text-sm bg-red-600 text-white disabled:opacity-50"
            >
              {isPending ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button onClick={() => { setRejectMode(null); setReason('') }}
              className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
