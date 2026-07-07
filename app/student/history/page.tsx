import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'
import { Icon } from '@/components/Icon'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getAllPeriods, TERM_LABEL } from '@/lib/examSettings'
import { getCurrentUser } from '@/lib/currentUser'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — History' }

// Everything that belongs to a term OTHER than the current one — the
// complement of the "My Requests" page, which only shows the active term
// (see keepActive in lib/examSettings.ts). Nothing is ever deleted; a request
// just moves here once its term is no longer active.
export default async function StudentHistoryPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [{ data: requests }, activePeriod, periods] = await Promise.all([
    supabase
      .from('special_exam_requests')
      .select('*, subjects(subject_code, subject_name)')
      .eq('student_id', user.id)
      .order('submitted_at', { ascending: false }),
    getActivePeriodCached(),
    getAllPeriods(supabase),
  ])

  const activeId = activePeriod?.id ?? null
  const list = (requests ?? []).filter((r) => r.period_id && r.period_id !== activeId)
  const termName = (periodId: string | null) => {
    const p = periods.find((p) => p.id === periodId)
    return p ? `${TERM_LABEL[p.term]}${p.schoolYear ? ` · ${p.schoolYear}` : ''}` : null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>History</h1>
        <p className="text-sm ef-muted">Requests from terms that have since ended. Your current term&apos;s requests are on My Requests.</p>
      </div>

      {list.length === 0 ? (
        <div className="ef-card rounded-xl shadow-sm px-4 py-14 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center" style={{ background: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)' }}>
            <Icon name="history" className="w-6 h-6" style={{ color: 'var(--sti-gold)' }} />
          </div>
          <p className="font-medium" style={{ color: 'var(--card-foreground)' }}>Nothing here yet</p>
          <p className="text-sm ef-muted mt-1">Requests from past terms will show up here once a new term starts.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((r) => {
            const subj = r.subjects as unknown as { subject_code: string; subject_name: string } | null
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
                  <p className="font-semibold truncate" style={{ color: 'var(--card-foreground)' }}>
                    {subj?.subject_name ?? 'Unknown subject'}
                  </p>
                  <p className="text-xs ef-muted">
                    {subj?.subject_code}{termName(r.period_id) ? ` · ${termName(r.period_id)}` : ''} · Submitted {new Date(r.submitted_at).toLocaleDateString()}
                  </p>
                </div>

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
  )
}
