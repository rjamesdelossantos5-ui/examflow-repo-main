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

export interface ExamPeriod {
  id: string
  term: Term
  schoolYear: string
  submissionStart: string // 'yyyy-mm-dd'
  windowDays: number
  examDay: string | null
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
