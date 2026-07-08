import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RequestStepper from '@/components/RequestStepper'
import { Icon, type IconName } from '@/components/Icon'
import { computeWindow, keepActive, TERM_LABEL } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import SubmissionStatusBanner from './SubmissionStatusBanner'
import SubmissionStatusModal from './SubmissionStatusModal'
import ScheduleAnnouncementModal from './ScheduleAnnouncementModal'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — My Requests' }

const IN_PROGRESS: RequestStatus[] = [
  'submitted', 'verified_by_registrar', 'approved_by_teacher', 'accepted', 'receipt_uploaded',
]

// Friendly, student-facing status pill (label + tone color) for the card.
function cardStatus(status: RequestStatus): { label: string; tone: string } {
  switch (status) {
    case 'submitted': return { label: 'Submitted', tone: '#64748b' }
    case 'verified_by_registrar': return { label: 'In Review', tone: '#3b82f6' }
    case 'approved_by_teacher': return { label: 'In Review', tone: '#3b82f6' }
    case 'accepted': return { label: 'Awaiting Receipt', tone: '#f59e0b' }
    case 'receipt_uploaded': return { label: 'Receipt In Review', tone: '#f59e0b' }
    case 'scheduled': return { label: 'Scheduled', tone: '#16a34a' }
    case 'rejected': return { label: 'Rejected', tone: '#dc2626' }
    default: return { label: status, tone: '#64748b' }
  }
}

// "Filed 2d ago" — short relative time for the card subheader.
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function StatCard({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: IconName }) {
  return (
    <div className="ef-card rounded-xl shadow-sm p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3 min-w-0">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: accent + '22' }}>
        <Icon name={icon} className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-2xl font-bold leading-none" style={{ color: 'var(--card-foreground)' }}>{value}</p>
        <p className="text-[11px] sm:text-xs ef-muted mt-1 truncate">{label}</p>
      </div>
    </div>
  )
}

export default async function StudentPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, schedule_ack, window_ack')
    .eq('id', user.id)
    .single()

  const [{ data: requests }, activePeriod] = await Promise.all([
    supabase
      .from('special_exam_requests')
      .select('*, subjects(subject_code, subject_name)')
      .eq('student_id', user.id)
      .order('submitted_at', { ascending: false }),
    getActivePeriodCached(),
  ])

  const win = computeWindow(activePeriod?.submissionStart ?? null, activePeriod?.windowDays ?? 7)
  const cookieStore = await cookies()
  const bannerDismissed = cookieStore.get('ef_banner_dismissed')?.value === '1'
  const modalSeen = cookieStore.get('ef_modal_seen')?.value === '1'
  // Once a term ends (a different one becomes active), its requests move to
  // History instead of sitting here forever — same "current term only" rule
  // already used for every staff queue.
  const list = keepActive(requests ?? [], activePeriod?.id ?? null)
  const counts = {
    total: list.length,
    inProgress: list.filter((r) => IN_PROGRESS.includes(r.status as RequestStatus)).length,
    rejected: list.filter((r) => r.status === 'rejected').length,
  }

  // One-time schedule popup: only while the student has a live (non-rejected)
  // request in the active period, and only if they haven't already
  // acknowledged THIS exact schedule (signature changes whenever the PH
  // updates it, so a genuine change re-prompts even if an older one was seen).
  const hasLiveRequest = activePeriod
    ? list.some((r) => r.status !== 'rejected' && (!r.period_id || r.period_id === activePeriod.id))
    : false
  const scheduleSignature = activePeriod?.scheduleUpdatedAt ? `${activePeriod.id}:${activePeriod.scheduleUpdatedAt}` : null
  const showSchedulePopup = !!(
    activePeriod?.examDay && scheduleSignature && hasLiveRequest && profile?.schedule_ack !== scheduleSignature
  )

  // Once the window is open AND the exam's end time is set, that's a
  // "settled" state — the popup should only ever nag once, not every login.
  // Anything short of that (not yet open, or open with no end time yet) is
  // still unresolved, so it keeps reappearing every login (cookie-based).
  const isSettled = win.open && !!activePeriod?.examEndDay
  const windowSignature = isSettled ? `${activePeriod!.id}:${activePeriod!.examEndDay}` : null
  const showWindowModal = isSettled
    ? profile?.window_ack !== windowSignature
    : !modalSeen

  return (
    <div className="space-y-6">
      {/* Only one popup at a time — the schedule announcement is the rarer,
          more directly actionable one, so it takes priority. */}
      {showSchedulePopup ? (
        <ScheduleAnnouncementModal
          show
          signature={scheduleSignature!}
          termLabel={activePeriod ? TERM_LABEL[activePeriod.term] : null}
          examDay={activePeriod!.examDay!}
          examEndDay={activePeriod?.examEndDay ?? null}
          examLocation={activePeriod?.examLocation ?? null}
          examBring={activePeriod?.examBring ?? null}
        />
      ) : (
        <SubmissionStatusModal
          termLabel={activePeriod ? TERM_LABEL[activePeriod.term] : null}
          open={win.open}
          notStarted={win.notStarted}
          daysRemaining={win.daysRemaining}
          start={win.start}
          end={win.end}
          show={showWindowModal}
          persistSignature={windowSignature}
        />
      )}
      <SubmissionStatusBanner
        termLabel={activePeriod ? TERM_LABEL[activePeriod.term] : null}
        open={win.open}
        notStarted={win.notStarted}
        daysRemaining={win.daysRemaining}
        windowDays={activePeriod?.windowDays ?? 7}
        start={win.start}
        end={win.end}
        examDay={activePeriod?.examDay ?? null}
        examEndDay={activePeriod?.examEndDay ?? null}
        examLocation={activePeriod?.examLocation ?? null}
        examBring={activePeriod?.examBring ?? null}
        initiallyDismissed={bannerDismissed}
      />
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Welcome, {profile?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-sm ef-muted">Here&apos;s an overview of your special exam requests.</p>
        </div>
        <Link
          href="/student/submit"
          className="px-5 py-2.5 rounded-lg font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity shrink-0"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          + New Request
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Requests" value={counts.total} accent="#64748b" icon="layers" />
        <StatCard label="In Progress" value={counts.inProgress} accent="#3b82f6" icon="clock" />
        <StatCard label="Rejected" value={counts.rejected} accent="#dc2626" icon="x-circle" />
      </div>

      {/* Request list */}
      <div>
        <h2 className="text-sm font-semibold ef-muted uppercase tracking-wide mb-3">Your Requests</h2>

        {list.length === 0 ? (
          <div className="ef-card rounded-xl shadow-sm px-4 py-14 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center" style={{ background: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)' }}>
              <Icon name="file" className="w-6 h-6" style={{ color: 'var(--sti-gold)' }} />
            </div>
            <p className="font-medium" style={{ color: 'var(--card-foreground)' }}>No requests yet {activePeriod ? `for ${TERM_LABEL[activePeriod.term]}` : ''}</p>
            <p className="text-sm ef-muted mt-1">Start by submitting your first special exam request.</p>
            <Link
              href="/student/submit"
              className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              + Submit a Request
            </Link>
            {(requests ?? []).length > 0 && (
              <p className="text-sm ef-muted mt-3">
                Looking for an old request? Check your{' '}
                <Link href="/student/history" className="underline font-medium" style={{ color: 'var(--card-foreground)' }}>History</Link>.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((r) => {
              const subj = r.subjects as unknown as { subject_code: string; subject_name: string } | null
              const status = r.status as RequestStatus
              const isPaid = r.exam_type === 'paid'
              // Paid + accepted = the cashier receipt still needs to be uploaded.
              const needsReceipt = isPaid && status === 'accepted'
              const isRejected = status === 'rejected'
              const pill = cardStatus(status)
              return (
                // The whole card links to the full detail page (files, submitted
                // details, activity timeline) via a stretched overlay link — but
                // the receipt / resubmit buttons sit ABOVE it (z-10) so they stay
                // independently clickable.
                <div key={r.id} className="ef-card relative rounded-2xl shadow-sm p-5 sm:p-6 transition-shadow hover:shadow-md">
                  <Link
                    href={`/student/requests/${r.id}`}
                    aria-label={`View details for ${subj?.subject_name ?? 'this request'}`}
                    className="absolute inset-0 rounded-2xl"
                  />

                  {/* Header: code, subject, type + filed time, status pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider ef-muted">{subj?.subject_code ?? '—'}</p>
                      <h3 className="text-lg font-bold leading-snug truncate" style={{ color: 'var(--card-foreground)' }}>
                        {subj?.subject_name ?? 'Unknown subject'}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${isPaid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'}`}>
                          {isPaid ? 'Paid exam' : 'Excused'}
                        </span>
                        <span className="text-xs ef-muted">Filed {timeAgo(r.submitted_at)}</span>
                      </div>
                    </div>
                    <span
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: `color-mix(in srgb, ${pill.tone} 14%, transparent)`, color: pill.tone }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: pill.tone }} />
                      {pill.label}
                    </span>
                  </div>

                  {/* Inline progress rail (rejected shows the strip below instead) */}
                  {!isRejected && (
                    <div className="mt-5">
                      <RequestStepper status={status} />
                    </div>
                  )}

                  {/* Fast receipt action — full upload form is on the detail page */}
                  {needsReceipt && (
                    <div
                      className="relative z-10 mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 35%, transparent)' }}
                    >
                      <p className="text-sm flex-1" style={{ color: 'var(--card-foreground)' }}>
                        <strong>Payment accepted.</strong> <span className="ef-muted">Upload your cashier receipt to get scheduled.</span>
                      </p>
                      <Link
                        href={`/student/requests/${r.id}`}
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                        style={{ background: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                      >
                        <Icon name="upload" className="w-4 h-4" /> Upload receipt
                      </Link>
                    </div>
                  )}

                  {/* Fast resubmit action when rejected */}
                  {isRejected && (
                    <div className="relative z-10 mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl px-4 py-3 bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30">
                      <p className="text-sm flex-1 text-red-700 dark:text-red-300">
                        <strong>Rejected.</strong> {r.rejection_reason ? r.rejection_reason : 'Fix the issue and resubmit — your details are kept.'}
                      </p>
                      <Link
                        href={`/student/submit?from=${r.id}`}
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                        style={{ background: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                      >
                        <Icon name="pencil" className="w-4 h-4" /> Edit &amp; Resubmit
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
