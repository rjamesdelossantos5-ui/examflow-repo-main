'use client'

import { useState } from 'react'
import RequestReviewPanel from '@/components/RequestReviewPanel'
import { verifyRequest, rejectRequest } from './actions'
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

export default function RegistrarQueue({ requests }: { requests: RequestRow[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const active = requests.find((r) => r.id === selected) ?? null

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>Pending Submissions</h2>

      {requests.length === 0 && (
        <div className="ef-card rounded-xl shadow-sm px-4 py-10 text-center ef-muted">
          No pending submissions.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* List */}
        <div className="space-y-2.5">
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id === selected ? null : r.id)}
              className={`ef-card w-full text-left rounded-xl shadow-sm p-4 transition-all hover:shadow-md ${
                selected === r.id ? 'ring-2 ring-[var(--sti-gold)]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--card-foreground)' }}>{r.student.full_name}</p>
                  <p className="text-sm ef-muted truncate">{r.subject.subject_code} — {r.subject.subject_name}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${r.exam_type === 'paid' ? 'bg-yellow-100 text-yellow-700' : 'bg-teal-100 text-teal-700'}`}>
                  {r.exam_type === 'paid' ? 'Paid' : 'Excused'}
                </span>
              </div>
              <p className="text-xs ef-muted mt-1">{new Date(r.submitted_at).toLocaleDateString()}</p>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {active && (
          <div className="ef-card rounded-xl shadow-sm p-6">
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
              onVerify={verifyRequest}
              onReject={rejectRequest}
              verifyLabel="Verify & Forward to Teacher"
            />
          </div>
        )}
      </div>
    </div>
  )
}
