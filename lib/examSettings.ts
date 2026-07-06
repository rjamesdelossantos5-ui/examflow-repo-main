import type { createClient } from '@/lib/supabase/server'

type DB = Awaited<ReturnType<typeof createClient>>

export interface ExamSettings {
  submissionStart: string | null // 'yyyy-mm-dd'
  windowDays: number
  examDay: string | null // ISO datetime
  examLocation: string | null
  examBring: string | null
}

const KEYS = ['submission_start', 'submission_window_days', 'exam_day', 'exam_location', 'exam_bring']

export async function getExamSettings(supabase: DB): Promise<ExamSettings> {
  const { data } = await supabase.from('settings').select('key, value').in('key', KEYS)
  const map = new Map<string, string>(
    ((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]),
  )
  return {
    submissionStart: map.get('submission_start') || null,
    windowDays: Number(map.get('submission_window_days') ?? 7) || 7,
    examDay: map.get('exam_day') || null,
    examLocation: map.get('exam_location') || null,
    examBring: map.get('exam_bring') || null,
  }
}

export interface SubmissionWindow {
  configured: boolean
  open: boolean
  notStarted: boolean
  start: string | null // ISO
  end: string | null // ISO
  daysRemaining: number | null
}

// Computes the live submission window. Start date + N days (inclusive) — e.g.
// Aug 1 with 7 days is open through the end of Aug 7. If no start date is set,
// the window is treated as always-open (backward compatible / unconfigured).
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
