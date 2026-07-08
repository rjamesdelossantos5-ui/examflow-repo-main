import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { computeWindow, keepActive, TERM_LABEL, SEMESTER_LABEL } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import SubmissionStatusBanner from './SubmissionStatusBanner'
import SubmissionStatusModal from './SubmissionStatusModal'
import ScheduleAnnouncementModal from './ScheduleAnnouncementModal'
import RequestsPanel, { type StudentRequest } from './RequestsPanel'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — My Requests' }

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
  // Shown wherever the current term is named (banner, modals, list) — e.g.
  // "1st Semester · Finals".
  const termLabel = activePeriod ? `${SEMESTER_LABEL[activePeriod.semester]} · ${TERM_LABEL[activePeriod.term]}` : null
  // Serializable rows for the interactive (client) panel below.
  const panelRequests: StudentRequest[] = list.map((r) => {
    const subj = r.subjects as unknown as { subject_code: string; subject_name: string } | null
    return {
      id: r.id as string,
      status: r.status as RequestStatus,
      exam_type: r.exam_type as string,
      submitted_at: r.submitted_at as string,
      rejection_reason: (r.rejection_reason as string | null) ?? null,
      subject_code: subj?.subject_code ?? null,
      subject_name: subj?.subject_name ?? null,
    }
  })

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
          termLabel={termLabel}
          examDay={activePeriod!.examDay!}
          examEndDay={activePeriod?.examEndDay ?? null}
          examLocation={activePeriod?.examLocation ?? null}
          examBring={activePeriod?.examBring ?? null}
        />
      ) : (
        <SubmissionStatusModal
          termLabel={termLabel}
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
        termLabel={termLabel}
        open={win.open}
        notStarted={win.notStarted}
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

      {/* Stat cards + request list — the cards double as status filters */}
      <RequestsPanel
        requests={panelRequests}
        termLabel={termLabel}
        hasHistory={(requests ?? []).length > 0}
      />
    </div>
  )
}
