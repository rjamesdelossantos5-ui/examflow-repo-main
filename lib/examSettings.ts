import type { createClient } from '@/lib/supabase/server'

type DB = Awaited<ReturnType<typeof createClient>>

export const TERMS = ['prelim', 'midterms', 'prefinals', 'finals'] as const
export type Term = (typeof TERMS)[number]
export const TERM_LABEL: Record<Term, string> = {
  prelim: 'Prelim',
  midterms: 'Midterms',
  prefinals: 'Pre-finals',
  finals: 'Finals',
}

// The term after this one (used to suggest the next window once a term ends).
export function nextTerm(t: Term): Term {
  const i = TERMS.indexOf(t)
  return TERMS[Math.min(i + 1, TERMS.length - 1)]
}

export interface ExamPeriod {
  id: string
  term: Term
  schoolYear: string
  submissionStart: string // 'yyyy-mm-dd'
  windowDays: number
  examDay: string | null // START of the exam window (ISO)
  examEndDay: string | null // END of the exam window (ISO); null = single day
  examLocation: string | null
  examBring: string | null
  isActive: boolean
}

interface PeriodRow {
  id: string
  term: string
  school_year: string | null
  submission_start: string
  window_days: number
  exam_day: string | null
  exam_end_day: string | null
  exam_location: string | null
  exam_bring: string | null
  is_active: boolean
}

function toPeriod(r: PeriodRow): ExamPeriod {
  return {
    id: r.id,
    term: r.term as Term,
    schoolYear: r.school_year ?? '',
    submissionStart: r.submission_start,
    windowDays: r.window_days || 7,
    examDay: r.exam_day,
    examEndDay: r.exam_end_day ?? null,
    examLocation: r.exam_location,
    examBring: r.exam_bring,
    isActive: r.is_active,
  }
}

export async function getActivePeriod(supabase: DB): Promise<ExamPeriod | null> {
  const { data } = await supabase.from('exam_periods').select('*').eq('is_active', true).limit(1).maybeSingle()
  return data ? toPeriod(data as PeriodRow) : null
}

export async function getAllPeriods(supabase: DB): Promise<ExamPeriod[]> {
  const { data } = await supabase.from('exam_periods').select('*').order('created_at', { ascending: false })
  return ((data ?? []) as PeriodRow[]).map(toPeriod)
}

export async function getPeriodById(supabase: DB, id: string): Promise<ExamPeriod | null> {
  const { data } = await supabase.from('exam_periods').select('*').eq('id', id).maybeSingle()
  return data ? toPeriod(data as PeriodRow) : null
}

// The effective end of a period's exam (end day if set, else the single day).
// A period is "over" once the whole of that day has passed.
export function periodExamEnded(p: { examDay: string | null; examEndDay: string | null }): boolean {
  const end = p.examEndDay ?? p.examDay
  if (!end) return false
  const d = new Date(end)
  d.setHours(23, 59, 59, 999)
  return d.getTime() < Date.now()
}

// IDs of periods whose exam day has fully passed. Requests tagged with one of
// these vanish from every queue so the next term starts clean. (Requests with a
// null period_id — legacy — are never auto-hidden.)
export async function endedPeriodIds(supabase: DB): Promise<Set<string>> {
  const { data } = await supabase.from('exam_periods').select('id, exam_day, exam_end_day')
  const ended = new Set<string>()
  for (const r of (data ?? []) as { id: string; exam_day: string | null; exam_end_day: string | null }[]) {
    if (periodExamEnded({ examDay: r.exam_day, examEndDay: r.exam_end_day })) ended.add(r.id)
  }
  return ended
}

// Drop rows belonging to a period whose exam has ended. `period_id` may be
// absent on legacy rows; those always stay.
export function hideEnded<T extends { period_id?: string | null }>(rows: T[], ended: Set<string>): T[] {
  if (!ended.size) return rows
  return rows.filter((r) => !r.period_id || !ended.has(r.period_id))
}

export interface SubmissionWindow {
  configured: boolean
  open: boolean
  notStarted: boolean
  start: string | null // ISO
  end: string | null // ISO
  daysRemaining: number | null
}

// Live submission window: start date + N days (inclusive). No active period =
// always-open (unconfigured / backward compatible).
export function computeWindow(submissionStart: string | null, windowDays: number): SubmissionWindow {
  if (!submissionStart) {
    return { configured: false, open: true, notStarted: false, start: null, end: null, daysRemaining: null }
  }
  const start = new Date(submissionStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + Math.max(1, windowDays) - 1)
  end.setHours(23, 59, 59, 999)

  const now = new Date()
  const notStarted = now < start
  const open = now >= start && now <= end
  const daysRemaining = open ? Math.ceil((end.getTime() - now.getTime()) / 86_400_000) : null

  return { configured: true, open, notStarted, start: start.toISOString(), end: end.toISOString(), daysRemaining }
}
