import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// One normalized fact per student who took (was scheduled for) a special exam
// — the common shape both data sources below get flattened into.
export interface ExamStatRow {
  examDate: string // 'yyyy-mm-dd'
  departmentName: string
  subjectCode: string
  subjectName: string
  examType: 'paid' | 'excused'
  term: string | null
  semester: string | null
  schoolYear: string | null
}

const UNKNOWN_DEPT = 'Unassigned'
const UNKNOWN_SUBJECT = 'Unknown Subject'

/**
 * Every student who has taken a special exam, for the Admin Analytics
 * dashboard — merged from two sources:
 *
 *  1. Live `special_exam_requests` at status 'scheduled' — the current term's
 *     students, still in the live table (not yet purged).
 *  2. `exam_history` — anonymized rows written by purgeExpiredExams() just
 *     before it permanently deletes a past term's requests (see
 *     migration_exam_history.sql). Without this, a term's numbers would
 *     disappear from analytics the day after its exam, once purged.
 *
 * Without merging both, the dashboard would either miss the current term
 * (history-only) or lose everything older than one term (live-only) — so
 * "today's" and "last year's" numbers both need to come from here together.
 */
export async function getExamStatRows(supabase: SupabaseServerClient): Promise<ExamStatRow[]> {
  const [liveRows, historyRows] = await Promise.all([
    getLiveScheduledRows(supabase),
    getHistoryRows(supabase),
  ])
  return [...liveRows, ...historyRows]
}

async function getLiveScheduledRows(supabase: SupabaseServerClient): Promise<ExamStatRow[]> {
  const { data } = await supabase
    .from('special_exam_requests')
    .select(`
      final_schedule, period_id, exam_type,
      subjects(subject_code, subject_name, departments(name))
    `)
    .eq('status', 'scheduled')
  // The Supabase client can't statically know a joined relation is single (not
  // an array) without generated types — `as unknown as` is the established
  // workaround used throughout this codebase for that (see any `r.subjects as
  // unknown as {...}` cast in the app/ role queries).
  const rows = (data ?? []) as unknown as {
    final_schedule: string | null
    period_id: string | null
    exam_type: string
    subjects: { subject_code: string; subject_name: string; departments: { name: string } | null } | null
  }[]
  if (!rows.length) return []

  // Batch-fetch the periods these rows reference, for the exam date + term
  // labels (most rows have final_schedule = null — that column is only set on
  // the rare admin-override path, so the period's exam_day is the real date).
  const periodIds = [...new Set(rows.map((r) => r.period_id).filter((x): x is string => !!x))]
  const { data: periods } = periodIds.length
    ? await supabase.from('exam_periods').select('id, term, semester, school_year, exam_day').in('id', periodIds)
    : { data: [] as { id: string; term: string; semester: string | null; school_year: string | null; exam_day: string | null }[] }
  const periodMap = new Map((periods ?? []).map((p) => [p.id, p]))

  const today = new Date().toISOString().slice(0, 10)
  return rows.map((r) => {
    const period = r.period_id ? periodMap.get(r.period_id) : undefined
    const dateSource = period?.exam_day ?? r.final_schedule
    return {
      examDate: dateSource ? new Date(dateSource).toISOString().slice(0, 10) : today,
      departmentName: r.subjects?.departments?.name ?? UNKNOWN_DEPT,
      subjectCode: r.subjects?.subject_code ?? '—',
      subjectName: r.subjects?.subject_name ?? UNKNOWN_SUBJECT,
      examType: (r.exam_type as 'paid' | 'excused') ?? 'paid',
      term: period?.term ?? null,
      semester: period?.semester ?? null,
      schoolYear: period?.school_year ?? null,
    }
  })
}

async function getHistoryRows(supabase: SupabaseServerClient): Promise<ExamStatRow[]> {
  // exam_history may not exist yet if migration_exam_history.sql hasn't been
  // run — fail open (empty history) rather than break the whole dashboard.
  const { data, error } = await supabase
    .from('exam_history')
    .select(`
      exam_date, exam_type, term, semester, school_year,
      subjects(subject_code, subject_name),
      departments(name)
    `)
    .order('exam_date', { ascending: false })
    .limit(5000)
  if (error) return []

  type Row = {
    exam_date: string
    exam_type: string
    term: string | null
    semester: string | null
    school_year: string | null
    subjects: { subject_code: string; subject_name: string } | null
    departments: { name: string } | null
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    examDate: r.exam_date,
    departmentName: r.departments?.name ?? UNKNOWN_DEPT,
    subjectCode: r.subjects?.subject_code ?? '—',
    subjectName: r.subjects?.subject_name ?? UNKNOWN_SUBJECT,
    examType: (r.exam_type as 'paid' | 'excused') ?? 'paid',
    term: r.term,
    semester: r.semester,
    schoolYear: r.school_year,
  }))
}
