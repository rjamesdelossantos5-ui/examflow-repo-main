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

// A single school-wide semester for now (1st / 2nd). Per-program semesters
// (e.g. a course running a 3rd/summer term) are a later change.
export const SEMESTERS = ['1st', '2nd'] as const
export type Semester = (typeof SEMESTERS)[number]
export const SEMESTER_LABEL: Record<Semester, string> = {
  '1st': '1st Semester',
  '2nd': '2nd Semester',
}

// The term after this one (used to suggest the next window once a term ends).
export function nextTerm(t: Term): Term {
  const i = TERMS.indexOf(t)
  return TERMS[Math.min(i + 1, TERMS.length - 1)]
}

export interface ExamPeriod {
  id: string
  term: Term
  semester: Semester
  schoolYear: string
  submissionStart: string // 'yyyy-mm-dd'
  windowDays: number
  examDay: string | null // START of the exam window (ISO)
  examEndDay: string | null // END of the exam window (ISO); null = single day
  examLocation: string | null
  examBring: string | null
  isActive: boolean
  createdAt: string
  scheduleUpdatedAt: string | null
}

interface PeriodRow {
  id: string
  term: string
  semester: string | null
  school_year: string | null
  submission_start: string
  window_days: number
  exam_day: string | null
  exam_end_day: string | null
  exam_location: string | null
  exam_bring: string | null
  is_active: boolean
  created_at: string
  schedule_updated_at: string | null
}

function toPeriod(r: PeriodRow): ExamPeriod {
  return {
    id: r.id,
    term: r.term as Term,
    semester: (r.semester as Semester) ?? '1st',
    schoolYear: r.school_year ?? '',
    submissionStart: r.submission_start,
    windowDays: r.window_days || 7,
    examDay: r.exam_day,
    examEndDay: r.exam_end_day ?? null,
    examLocation: r.exam_location,
    examBring: r.exam_bring,
    isActive: r.is_active,
    createdAt: r.created_at,
    scheduleUpdatedAt: r.schedule_updated_at ?? null,
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

// The id of the active term, or null if none is set. Staff queues use this to
// show only the current term's forms — the previous term's forms drop off the
// moment a new term is activated (the PH controls the cutover; nothing vanishes
// on a timer).
export async function activePeriodId(supabase: DB): Promise<string | null> {
  const { data } = await supabase.from('exam_periods').select('id').eq('is_active', true).limit(1).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

// Keep only rows belonging to the active term. Legacy rows (null period_id) and
// the case of no active term both fall through unfiltered so nothing is ever
// hidden unexpectedly.
export function keepActive<T extends { period_id?: string | null }>(rows: T[], activeId: string | null): T[] {
  if (!activeId) return rows
  return rows.filter((r) => !r.period_id || r.period_id === activeId)
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
