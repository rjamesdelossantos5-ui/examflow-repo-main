import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { keepActive } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import AssessmentList, { type StudentAssessment } from './AssessmentList'
import { getSpecialExamFee } from '@/lib/fees'

export const metadata = { title: 'EXAMFLOW — Payment Assessment' }

/**
 * The Registrar's second touch of a paid request.
 *
 * Once the Program Head accepts, the student owes a fee per subject — but they
 * may have several subjects, and the Cashier needs one total, not one payment
 * per exam. This page groups every accepted PAID request by student so the
 * Registrar can see the whole bill at once, pass it to the Cashier, and stamp it.
 *
 * Excused requests never appear: they skip 'accepted' and go straight to
 * 'scheduled' with no fee (see acceptRequest in app/program-head/actions.ts).
 */
export default async function PaymentAssessmentPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const SELECT = `
    id, student_id, status, exam_type, submitted_at, period_id,
    payment_assessed_at, assessed_fee,
    profiles!student_id(full_name, student_number, course, year_level, section),
    subjects(subject_code, subject_name)
  `
  const load = (select: string) => supabase
    .from('special_exam_requests')
    .select(select)
    .eq('status', 'accepted')
    .eq('exam_type', 'paid')
    .order('submitted_at', { ascending: true })

  // The admin-set fee per subject (lib/fees.ts), for students not yet assessed.
  const [res0, fee] = await Promise.all([load(SELECT), getSpecialExamFee(supabase)])
  let res = res0

  // migration_fee_setting.sql not applied yet — no assessed_fee column. Retry
  // without it; assessed students then show the current fee.
  if (res.error) {
    console.error('[registrar/assessment] assessed_fee unavailable — is migration_fee_setting.sql applied?', res.error)
    res = await load(SELECT.replace(' assessed_fee,', ''))
  }

  // migration_payment_assessment.sql not applied yet — payment_assessed_at does
  // not exist, so the select errors. Retry without it rather than showing the
  // Registrar an empty page: the rows are still worth seeing, they just cannot
  // be marked assessed until the migration runs.
  let rows = res.data as Record<string, unknown>[] | null
  let migrated = true
  if (res.error) {
    console.error('[registrar/assessment] payment_assessed_at unavailable — is migration_payment_assessment.sql applied?', res.error)
    migrated = false
    const fallback = await load(SELECT.replace('payment_assessed_at, assessed_fee,', ''))
    rows = fallback.data as Record<string, unknown>[] | null
  }

  // Current term only — same rule as every other staff queue.
  const activePeriod = await getActivePeriodCached()
  const list = keepActive(rows ?? [], activePeriod?.id ?? null)

  // One card per student, not per request: the Registrar assesses a person's
  // whole bill, and a student with three subjects is one trip to the Cashier.
  const byStudent = new Map<string, StudentAssessment>()
  for (const r of list) {
    const studentId = r.student_id as string
    const prof = r.profiles as unknown as {
      full_name: string; student_number: string | null; course: string | null
      year_level: number | null; section: string | null
    } | null
    const subj = r.subjects as unknown as { subject_code: string; subject_name: string } | null

    let entry = byStudent.get(studentId)
    if (!entry) {
      entry = {
        studentId,
        name: prof?.full_name ?? '—',
        studentNumber: prof?.student_number ?? null,
        course: prof?.course ?? null,
        yearLevel: prof?.year_level ?? null,
        section: prof?.section ?? null,
        subjects: [],
        assessedAt: null,
      }
      byStudent.set(studentId, entry)
    }
    entry.subjects.push({
      id: r.id as string,
      code: subj?.subject_code ?? '—',
      name: subj?.subject_name ?? '—',
      assessedFee: (r.assessed_fee as number | null | undefined) ?? null,
    })
    // A student is "assessed" once any of their rows carries the stamp — the
    // action stamps them all together, so they never disagree.
    const stamped = (r.payment_assessed_at as string | null) ?? null
    if (stamped) entry.assessedAt = stamped
  }

  const students = [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name))

  return <AssessmentList students={students} migrated={migrated} fee={fee} />
}
