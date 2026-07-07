'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import RequestReviewPanel from '@/components/RequestReviewPanel'
import { Icon } from '@/components/Icon'
import { approveRequest, rejectTeacherRequest } from './actions'
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
  student: { full_name: string }
  subject: { subject_code: string; subject_name: string }
  media: { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string; signed_url?: string }[]
  logs: { id: string; action: string; created_at: string; actor_role: string }[]
}

export default function TeacherQueue({ requests }: { requests: RequestRow[] }) {
  const reqParam = useSearchParams().get('req')
  const [selected, setSelected] = useState<string | null>(reqParam)
  const [items, setItems] = useState(requests)
  useEffect(() => setItems(requests), [requests])
  const active = items.find((r) => r.id === selected) ?? null

  function dropActive() {
    setItems((prev) => prev.filter((r) => r.id !== selected))
    setSelected(null)
  }

  // Opening from a notification (?req=…) auto-selects that request and scrolls it into view.
  useEffect(() => {
    if (reqParam) {
      setSelected(reqParam)
      document.getElementById(`req-${reqParam}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [reqParam])

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>Requests Awaiting Your Approval</h2>

      {items.length === 0 && (
        <div className="ef-card rounded-xl shadow-sm px-4 py-10 text-center ef-muted">
          No pending requests.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <div className="space-y-2.5">
          {items.map((r) => (
            <button
              key={r.id}
              id={`req-${r.id}`}
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
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.exam_type === 'paid' ? 'bg-yellow-100 text-yellow-700' : 'bg-teal-100 text-teal-700'}`}>
                    {r.exam_type === 'paid' ? 'Paid' : 'Excused'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">✓ Registrar verified</span>
                  {r.resubmitted && <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Resubmitted</span>}
                </div>
              </div>
              <p className="text-xs ef-muted mt-1">{new Date(r.submitted_at).toLocaleDateString()}</p>
            </button>
          ))}
        </div>

        {/* Detail panel — sticky so it stays in view while scanning the list */}
        {items.length > 0 && (
          <div className="md:sticky md:top-20">
            {active ? (
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
                  onVerify={approveRequest}
                  onReject={rejectTeacherRequest}
                  onDone={dropActive}
                  rejectPresets={TEACHER_REJECT}
                  verifyLabel="Approve & Forward to Program Head"
                  actionableStatus="verified_by_registrar"
                  showDocuments={false}
                />
              </div>
            ) : (
              <div className="hidden md:flex flex-col items-center justify-center rounded-xl border-2 border-dashed ef-border px-6 py-20 text-center ef-muted">
                <Icon name="file" className="w-8 h-8 mb-2 opacity-60" />
                <p className="text-sm">Select a request to review its details.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
