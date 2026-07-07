import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'
import { Icon, type IconName } from '@/components/Icon'
import { computeWindow, TERM_LABEL } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import SubmissionStatusBanner from './SubmissionStatusBanner'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — My Requests' }

const IN_PROGRESS: RequestStatus[] = [
  'submitted', 'verified_by_registrar', 'approved_by_teacher', 'accepted', 'receipt_uploaded',
]

function StatCard({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: IconName }) {
  return (
    <div className="ef-card rounded-xl shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: accent + '22' }}>
        <Icon name={icon} className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none" style={{ color: 'var(--card-foreground)' }}>{value}</p>
        <p className="text-xs ef-muted mt-1">{label}</p>
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
    .select('full_name')
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
  const bannerDismissed = (await cookies()).get('ef_banner_dismissed')?.value === '1'
  const list = requests ?? []
  const counts = {
    total: list.length,
    inProgress: list.filter((r) => IN_PROGRESS.includes(r.status as RequestStatus)).length,
    rejected: list.filter((r) => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      <SubmissionStatusBanner
        termLabel={activePeriod ? TERM_LABEL[activePeriod.term] : null}
        open={win.open}
        notStarted={win.notStarted}
        daysRemaining={win.daysRemaining}
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
            <p className="font-medium" style={{ color: 'var(--card-foreground)' }}>No requests yet</p>
            <p className="text-sm ef-muted mt-1">Start by submitting your first special exam request.</p>
            <Link
              href="/student/submit"
              className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              + Submit a Request
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {list.map((r) => {
              const subj = r.subjects as unknown as { subject_code: string; subject_name: string } | null
              // Paid + accepted = the cashier receipt still needs to be uploaded.
              const needsReceipt = r.exam_type === 'paid' && r.status === 'accepted'
              return (
                <Link
                  key={r.id}
                  href={`/student/requests/${r.id}`}
                  className="ef-card group flex items-center gap-4 rounded-xl shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: 'var(--sti-navy)', color: 'var(--sti-gold)' }}
                  >
                    {subj?.subject_code?.slice(0, 3).toUpperCase() ?? '—'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--card-foreground)' }}>
                      {subj?.subject_name ?? 'Unknown subject'}
                      {needsReceipt && (
                        <span
                          className="shrink-0 inline-grid place-items-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold animate-pulse"
                          title="Action needed: upload your cashier receipt"
                        >
                          !
                        </span>
                      )}
                    </p>
                    <p className="text-xs ef-muted">
                      {subj?.subject_code} · Submitted {new Date(r.submitted_at).toLocaleDateString()}
                    </p>
                  </div>

                  {needsReceipt && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      ⚠ Receipt needed
                    </span>
                  )}

                  <span className={`hidden sm:inline-block px-2 py-0.5 rounded text-xs font-semibold ${r.exam_type === 'paid' ? 'bg-yellow-100 text-yellow-700' : 'bg-teal-100 text-teal-700'}`}>
                    {r.exam_type === 'paid' ? 'Paid' : 'Excused'}
                  </span>

                  <StatusBadge status={r.status as RequestStatus} />

                  <svg className="w-5 h-5 ef-muted group-hover:translate-x-0.5 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
