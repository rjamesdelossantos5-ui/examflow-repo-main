import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { attachSignedUrls } from '@/lib/supabase/getSignedUrls'
import { getCurrentUser } from '@/lib/currentUser'
import StatusBadge from '@/components/StatusBadge'
import DocumentViewer from '@/components/DocumentViewer'
import ReceiptUpload from './ReceiptUpload'
import DeleteRequestButton from './DeleteRequestButton'
import type { RequestStatus, UserRole } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — Request Detail' }

const ROLE_DOT: Record<UserRole, string> = {
  student: '#3b82f6',
  registrar: '#a855f7',
  subject_teacher: '#6366f1',
  program_head: '#f59e0b',
  admin: '#64748b',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
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
  // Cached — reuses the layout's auth lookup instead of a second round-trip.
  const user = await getCurrentUser()
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

  const subj = req.subjects as unknown as { subject_code: string; subject_name: string } | null
  const isRejected = req.status === 'rejected'

  const logs = (req.progress_logs as { id: string; action: string; created_at: string; actor_role: UserRole }[]) ?? []
  const rawMedia = (req.application_media as { id: string; file_name: string; media_type: string; mime_type: string; storage_path: string }[]) ?? []
  const signed = await attachSignedUrls(supabase, rawMedia)
  const media = rawMedia.map((m, i) => ({ ...m, signed_url: signed[i]?.signed_url }))

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/student" className="inline-flex items-center gap-1 text-sm ef-muted hover:underline">
        ← Back to My Requests
      </Link>

      {submitted && (
        <div className="ef-toast rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">
          ✓ Request submitted successfully!
        </div>
      )}

      {/* Header */}
      <div className="ef-card rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate" style={{ color: 'var(--card-foreground)' }}>
              {subj?.subject_name}
            </h1>
            <p className="text-sm ef-muted">{subj?.subject_code}</p>
          </div>
          <StatusBadge status={req.status as RequestStatus} />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="ef-muted">Type: </span>
            <span className="font-medium" style={{ color: 'var(--card-foreground)' }}>
              {req.exam_type === 'paid' ? 'Paid (Unexcused)' : 'Excused'}
            </span>
          </div>
          <div>
            <span className="ef-muted">Submitted: </span>
            <span className="font-medium" style={{ color: 'var(--card-foreground)' }}>
              {new Date(req.submitted_at).toLocaleDateString()}
            </span>
          </div>
          {req.excused_reason && (
            <div>
              <span className="ef-muted">Reason: </span>
              <span className="font-medium capitalize" style={{ color: 'var(--card-foreground)' }}>
                {req.excused_reason}{req.other_reason ? ` — ${req.other_reason}` : ''}
              </span>
            </div>
          )}
        </div>

        {isRejected && req.rejection_reason && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
            <strong>Rejected</strong> — {req.rejection_reason}
          </div>
        )}

        {req.final_schedule && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">
            <strong>Scheduled for:</strong> {new Date(req.final_schedule).toLocaleString()}
          </div>
        )}
      </div>

      {/* Submitted details (what the student entered on this form) */}
      <div className="ef-card rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--card-foreground)' }}>Submitted Details</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
          {[
            ['Name', req.snap_name],
            ['Contact No.', (req as { snap_contact_number?: string | null }).snap_contact_number],
            ['Student No.', req.snap_student_number],
            ['Course', req.snap_course],
            ['Year', req.snap_year_level],
            ['Section', req.snap_section],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs ef-muted">{label}</dt>
              <dd className="font-medium" style={{ color: 'var(--card-foreground)' }}>{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Receipt upload (Paid + accepted). If a prior receipt was rejected, the
          reason is still on the request — show it so the student can fix it. */}
      {req.exam_type === 'paid' && req.status === 'accepted' && (
        <ReceiptUpload requestId={req.id} rejectedReason={req.rejection_reason as string | null} />
      )}

      {/* Documents */}
      <div className="ef-card rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--card-foreground)' }}>Uploaded Documents</h2>
        <DocumentViewer media={media} />
      </div>

      {/* Timeline history */}
      <div className="ef-card rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--card-foreground)' }}>Activity Timeline</h2>
        <ol className="relative ml-2">
          {logs.map((log, i) => (
            <li key={log.id} className="relative pl-6 pb-5 last:pb-0">
              {i < logs.length - 1 && (
                <span className="absolute left-[5px] top-3 bottom-0 w-px" style={{ background: 'var(--border)' }} />
              )}
              <span
                className="absolute left-0 top-1.5 w-3 h-3 rounded-full ring-2"
                style={{ background: ROLE_DOT[log.actor_role] ?? '#64748b', boxShadow: '0 0 0 2px var(--card)' }}
              />
              <p className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>{log.action}</p>
              <p className="text-xs ef-muted mt-0.5">
                <span className="capitalize">{log.actor_role.replace(/_/g, ' ')}</span> · {timeAgo(log.created_at)}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {/* Withdraw (only while still pending registrar review) */}
      {req.status === 'submitted' && (
        <div className="ef-card rounded-xl shadow-sm p-6">
          <DeleteRequestButton requestId={req.id} />
        </div>
      )}

      {/* Rejected — edit & resubmit (details pre-filled) or delete */}
      {req.status === 'rejected' && (
        <div className="ef-card rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Want to try again?</h2>
            <p className="text-sm ef-muted mt-0.5">Your details are kept, so you just fix what was wrong and re-upload.</p>
          </div>
          <Link
            href={`/student/submit?from=${req.id}`}
            className="block w-full text-center py-2.5 rounded-lg font-semibold text-sm"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
          >
            Edit &amp; Resubmit
          </Link>
          <DeleteRequestButton requestId={req.id} label="Delete this request" />
        </div>
      )}
    </div>
  )
}
