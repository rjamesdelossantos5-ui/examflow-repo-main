import type { IconName } from '@/components/Icon'
import { createClient } from '@/lib/supabase/server'
import { keepActive, SEMESTER_LABEL, TERM_LABEL } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getMyProfileMeta } from '@/lib/myProfile'
import { keepMyDepartment } from '@/lib/deptFilter'
import { withSubmissionGate } from '@/lib/submissionGate'
import { displayName, surname } from '@/lib/initials'
import { DASHBOARD, type DashRole, type DashRow } from '@/lib/dashboardConfig'

export interface DashboardGroup {
  id: string
  subject: string
  section: string | null
  counts: Record<string, number>
}

export interface DashboardData {
  greeting: string
  subtitle: string
  empty: string
  termLabel: string | null
  cards: { key: string; label: string; icon: IconName; accent: string; value: number }[]
  groups: DashboardGroup[]
}

interface Raw {
  id: string
  status: string
  exam_type: string
  rejected_by_role: string | null
  payment_assessed_at?: string | null
  period_id: string | null
  subject_id: string | null
  snap_section: string | null
  profiles: { section: string | null } | null
  subjects: { subject_name: string; department_id: string | null } | null
}

const SELECT =
  'id, status, exam_type, rejected_by_role, payment_assessed_at, period_id, subject_id, snap_section, ' +
  'profiles!student_id(section), subjects(subject_name, department_id)'
const PAGE = 1000

/**
 * Counts for one role's dashboard: every request of the active term the role can
 * see, grouped by subject and section.
 *
 * The same rule as the queues decides which requests exist at all (parent
 * verified and the student pressed Submit — lib/submissionGate.ts), so these
 * numbers agree with the lists they sit above. Visibility is the database's: a
 * Teacher only gets requests for their own subjects. A Program Head is narrowed
 * to their department here; an admin (no department) sees everything.
 *
 * The database returns at most 1000 rows per request, so this reads in pages —
 * a school term can have more than that, and a silent cut-off would undercount.
 */
export async function getRoleDashboard(role: DashRole): Promise<DashboardData> {
  const supabase = await createClient()
  const [me, period] = await Promise.all([getMyProfileMeta(), getActivePeriodCached()])

  const fetchAll = async (select: string, gate: string | null) => {
    const out: Raw[] = []
    for (let from = 0; from < PAGE * 30; from += PAGE) {
      let q = supabase.from('special_exam_requests').select(select).order('id').range(from, from + PAGE - 1)
      if (gate) q = q.or(gate)
      const { data, error } = await q
      if (error) return { data: null, error }
      const page = (data ?? []) as unknown as Raw[]
      out.push(...page)
      if (page.length < PAGE) break
    }
    return { data: out, error: null }
  }

  let res = await withSubmissionGate((gate) => fetchAll(SELECT, gate))
  // payment_assessed_at only exists after migration_payment_assessment.sql.
  if (res.error) res = await withSubmissionGate((gate) => fetchAll(SELECT.replace(' payment_assessed_at,', ''), gate))

  let rows = keepActive(res.data ?? [], period?.id ?? null)
  if (role === 'program_head') rows = keepMyDepartment(rows, me?.department_id ?? null)

  const def = DASHBOARD[role]
  const totals: Record<string, number> = {}
  const byGroup = new Map<string, DashboardGroup>()
  for (const r of rows) {
    const facts: DashRow = {
      status: r.status,
      examType: r.exam_type,
      rejectedBy: r.rejected_by_role,
      assessed: !!r.payment_assessed_at,
    }
    const matched = def.cards.filter((c) => c.match(facts))
    // A request that is none of this role's business (the Total card is the
    // widest definition) is left out of the table too.
    if (!matched.some((c) => c.key === 'total')) continue
    const section = r.snap_section ?? r.profiles?.section ?? null
    const key = `${r.subject_id ?? ''}|${section ?? ''}`
    let g = byGroup.get(key)
    if (!g) {
      g = { id: key, subject: r.subjects?.subject_name ?? '—', section, counts: Object.fromEntries(def.cards.map((c) => [c.key, 0])) }
      byGroup.set(key, g)
    }
    for (const c of matched) {
      g.counts[c.key]++
      totals[c.key] = (totals[c.key] ?? 0) + 1
    }
  }

  const groups = [...byGroup.values()].sort((a, b) => a.subject.localeCompare(b.subject) || (a.section ?? '').localeCompare(b.section ?? ''))

  return {
    greeting: `Welcome, ${displayName(surname(me?.full_name))}`,
    subtitle: def.subtitle,
    empty: def.empty,
    termLabel: period ? `${SEMESTER_LABEL[period.semester]} · ${TERM_LABEL[period.term]}` : null,
    cards: def.cards.map((c) => ({ key: c.key, label: c.label, icon: c.icon, accent: c.accent, value: totals[c.key] ?? 0 })),
    groups,
  }
}
