import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/StatusBadge'
import ReceiptUpload from './ReceiptUpload'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — Request Detail' }

const STEPS: { status: RequestStatus; label: string }[] = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'verified_by_registrar', label: 'Verified by Registrar' },
  { status: 'approved_by_teacher', label: 'Approved by Teacher' },
  { status: 'accepted', label: 'Accepted by Program Head' },
  { status: 'scheduled', label: 'Scheduled' },
]

const STATUS_ORDER: Record<RequestStatus, number> = {
  submitted: 0,
  verified_by_registrar: 1,
  approved_by_teacher: 2,
  accepted: 3,
  receipt_uploaded: 3,
  scheduled: 4,
  rejected: -1,
}

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ submitted?: string }>
}) {
  const { id } = await params
  const { submitted } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: req } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      subjects(subject_code, subject_name, profiles(full_name)),
      application_media(*),
      progress_logs(*, profiles(full_name, role))
    `)
    .eq('id', id)
    .eq('student_id', user.id)
    .single()

  if (!req) notFound()

  const currentStep = STATUS_ORDER[req.status as RequestStatus]

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/student" className="text-sm text-gray-500 hover:underline">← My Requests</Link>
      </div>

      {submitted && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Request submitted successfully!
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--sti-navy)' }}>
              {(req.subjects as { subject_name: string })?.subject_name}
            </h1>
            <p className="text-sm text-gray-500">{(req.subjects as { subject_code: string })?.subject_code}</p>
          </div>
          <StatusBadge status={req.status as RequestStatus} />
        </div>

        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <span className="text-gray-500">Type: </span>
            <span className="font-medium capitalize">{req.exam_type === 'paid' ? 'Paid (Unexcused)' : 'Excused'}</span>
          </div>
          <div>
            <span className="text-gray-500">Submitted: </span>
            <span className="font-medium">{new Date(req.submitted_at).toLocaleDateString()}</span>
          </div>
        </div>

        {req.excused_reason && (
          <div className="mt-2 text-sm">
            <span className="text-gray-500">Reason: </span>
            <span className="font-medium capitalize">{req.excused_reason}</span>
            {req.other_reason && <span> — {req.other_reason}</span>}
          </div>
        )}

        {req.status === 'rejected' && req.rejection_reason && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <strong>Rejected</strong> — {req.rejection_reason}
          </div>
        )}

        {req.final_schedule && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            <strong>Scheduled for:</strong>{' '}
            {new Date(req.final_schedule).toLocaleString()}
          </div>
        )}
      </div>

      {/* Status Tracker */}
      {req.status !== 'rejected' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Progress</h2>
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const done = currentStep >= i
              const active = currentStep === i
              return (
                <div key={step.status} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      done
                        ? 'border-[var(--sti-gold)] bg-[var(--sti-gold)] text-[var(--sti-navy)]'
                        : 'border-gray-300 text-gray-400'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs text-center leading-tight ${active ? 'font-semibold' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="absolute" style={{ display: 'none' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Receipt upload (Paid + accepted) */}
      {req.exam_type === 'paid' && req.status === 'accepted' && (
        <ReceiptUpload requestId={req.id} />
      )}

      {/* Documents */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-gray-700 mb-3">Uploaded Documents</h2>
        <ul className="space-y-2">
          {((req.application_media as { id: string; file_name: string; media_type: string }[]) ?? []).map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">📄</span>
              <span className="font-medium capitalize">{m.media_type.replace(/_/g, ' ')}</span>
              <span className="text-gray-400">—</span>
              <span className="text-gray-600">{m.file_name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-gray-700 mb-3">Activity History</h2>
        <ol className="space-y-3">
          {((req.progress_logs as { id: string; action: string; created_at: string; actor_role: string }[]) ?? []).map((log) => (
            <li key={log.id} className="flex gap-3 text-sm">
              <span className="text-gray-400 text-xs mt-0.5 shrink-0">{new Date(log.created_at).toLocaleString()}</span>
              <div>
                <span className="font-medium">{log.action}</span>
                <span className="ml-1 text-gray-400 capitalize">({log.actor_role.replace(/_/g, ' ')})</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
