'use client'

import { useState } from 'react'
import RequestReviewPanel from '@/components/RequestReviewPanel'
import { approveRequest, rejectTeacherRequest } from './actions'
import type { RequestStatus } from '@/lib/supabase/types'

interface RequestRow {
  id: string
  exam_type: string
  excused_reason: string | null
  other_reason: string | null
  status: RequestStatus
  submitted_at: string
  student: { full_name: string }
  subject: { subject_code: string; subject_name: string }
  media: { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string; signed_url?: string }[]
  logs: { id: string; action: string; created_at: string; actor_role: string }[]
}

export default function TeacherQueue({ requests }: { requests: RequestRow[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const active = requests.find((r) => r.id === selected) ?? null

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Requests Awaiting Your Approval</h2>

      {requests.length === 0 && (
        <div className="bg-white rounded-xl shadow px-4 py-10 text-center text-gray-400">
          No pending requests.
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
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700">✓ Registrar verified</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{new Date(r.submitted_at).toLocaleDateString()}</p>
            </button>
          ))}
        </div>

        {active && (
          <div className="bg-white rounded-xl shadow p-6">
            <RequestReviewPanel
              requestId={active.id}
              studentName={active.student.full_name}
              subjectName={active.subject.subject_name}
              subjectCode={active.subject.subject_code}
              examType={active.exam_type}
              excusedReason={active.excused_reason}
              otherReason={active.other_reason}
              status={active.status}
              media={active.media}
              logs={active.logs}
              onVerify={approveRequest}
              onReject={rejectTeacherRequest}
              verifyLabel="Approve & Forward to Program Head"
            />
          </div>
        )}
      </div>
    </div>
  )
}
