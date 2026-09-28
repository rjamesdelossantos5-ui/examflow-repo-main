import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { TERM_LABEL, type Term } from '@/lib/examSettings'
import {
  composeRequestEmail,
  type Audience,
  type ComposedEmail,
  type RequestEmailEvent,
  type RequestEmailInfo,
} from '@/lib/requestEmailContent'

/**
 * Email notifications for a special exam request — who gets which email, and
 * what it says. Sending itself is lib/email.ts.
 *
 * Called from Server Actions through Next's after(), so the email goes out
 * after the reviewer's click has already been answered and a slow or failing
 * send never holds up (or undoes) the approval. On Vercel, after() keeps the
 * function alive until the send finishes.
 *
 * Recipients mirror who can see each queue:
 *  - Registrar: every active registrar.
 *  - Teacher: the section's routed teacher, else the subject's own teacher.
 *  - Program Head: active Program Heads of the subject's department, plus any
 *    with no department (they see every department — lib/deptFilter.ts).
 *  - Student: the request's owner — at every decision, and a progress update
 *    after the Registrar verifies and after the teacher approves.
 * Parents get nothing: EXAMFLOW has no parent email address on file.
 *
 * Looked up with the service-role client, because the person acting (say, a
 * student pressing Submit) cannot read other users' profiles. Only email
 * addresses and the names already shown on the request are read.
 */

// The events and what each email says live in lib/requestEmailContent.ts.
export type { RequestEmailEvent } from '@/lib/requestEmailContent'

type Admin = NonNullable<ReturnType<typeof createAdminClient>>

interface RequestRow {
  info: RequestEmailInfo
  studentEmail: string | null
  departmentId: string | null
  teacherId: string | null
}

// Everything the email shows about the request. The exam date is the period's
// exam_day, else the request's own final_schedule — the same order
// lib/examAnalytics.ts uses.
const REQUEST_SELECT =
  'id, teacher_id, exam_type, excused_reason, other_reason, submitted_at, final_schedule, ' +
  'snap_name, snap_student_number, snap_course, snap_year_level, snap_section, ' +
  'period:exam_periods(term, school_year, exam_day, exam_end_day, exam_location, exam_bring), ' +
  'student:profiles!student_id(full_name, email), teacher:profiles!teacher_id(full_name), ' +
  'subject:subjects(subject_code, subject_name, department_id, teacher_id, subject_teacher:profiles!teacher_id(full_name))'

export async function emailRequestEvent(
  event: RequestEmailEvent,
  requestIds: string[],
  opts: { reason?: string } = {},
): Promise<void> {
  try {
    const ids = [...new Set(requestIds)].filter(Boolean)
    if (!ids.length) return
    const admin = createAdminClient()
    if (!admin) {
      console.warn('[requestEmails] SUPABASE_SERVICE_ROLE_KEY not set — skipped', event)
      return
    }
    const base = await siteUrl()

    const { data, error } = await admin.from('special_exam_requests').select(REQUEST_SELECT).in('id', ids)
    if (error || !data) {
      console.error('[requestEmails] could not read the requests', event, error)
      return
    }

    for (const row of data as unknown as Record<string, unknown>[]) {
      await send(admin, event, toRequestRow(row), base, opts.reason ?? '')
    }
  } catch (err) {
    console.error('[requestEmails]', event, err)
  }
}

function toRequestRow(row: Record<string, unknown>): RequestRow {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  const student = row.student as { full_name: string; email: string } | null
  const teacher = row.teacher as { full_name: string } | null
  const subject = row.subject as {
    subject_code: string
    subject_name: string
    department_id: string | null
    teacher_id: string | null
    subject_teacher: { full_name: string } | null
  } | null
  const period = row.period as {
    term: string
    school_year: string | null
    exam_day: string | null
    exam_end_day: string | null
    exam_location: string | null
    exam_bring: string | null
  } | null

  const termLabel = period
    ? [TERM_LABEL[period.term as Term] ?? period.term, period.school_year].filter(Boolean).join(' · ')
    : null
  const examType = row.exam_type === 'paid' || row.exam_type === 'excused' ? row.exam_type : null

  return {
    info: {
      id: row.id as string,
      studentName: str(row.snap_name) ?? student?.full_name ?? 'A student',
      studentNumber: str(row.snap_student_number),
      course: str(row.snap_course),
      yearLevel: typeof row.snap_year_level === 'number' ? row.snap_year_level : null,
      section: str(row.snap_section),
      code: subject?.subject_code ?? 'a subject',
      subjectName: subject?.subject_name ?? '',
      teacherName: teacher?.full_name ?? subject?.subject_teacher?.full_name ?? null,
      examType,
      excusedReason: str(row.excused_reason),
      otherReason: str(row.other_reason),
      termLabel,
      submittedAt: str(row.submitted_at),
      examStart: period?.exam_day ?? str(row.final_schedule),
      examEnd: period?.exam_end_day ?? null,
      examLocation: period?.exam_location ?? null,
      examBring: period?.exam_bring ?? null,
    },
    studentEmail: student?.email ?? null,
    departmentId: subject?.department_id ?? null,
    teacherId: (row.teacher_id as string | null) ?? subject?.teacher_id ?? null,
  }
}

async function send(admin: Admin, event: RequestEmailEvent, r: RequestRow, base: string, reason: string) {
  const mail = (audience: Audience) => composeRequestEmail(event, audience, r.info, base, reason)
  const toStudent = () => deliver({ to: r.studentEmail ? [r.studentEmail] : [] }, mail('student'))
  const toStaff = async (emails: Promise<string[]>, audience: Audience) => deliver({ bcc: await emails }, mail(audience))

  switch (event) {
    case 'submitted':
      return toStaff(registrarEmails(admin), 'registrar')
    case 'reverified':
    case 'receipt_uploaded':
      return toStaff(programHeadEmails(admin, r.departmentId), 'program_head')
    case 'registrar_verified':
      await toStudent()
      return toStaff(teacherEmails(admin, r.teacherId), 'teacher')
    case 'teacher_approved':
      await toStudent()
      return toStaff(programHeadEmails(admin, r.departmentId), 'program_head')
    case 'rejected':
    case 'returned':
    case 'scheduled':
    case 'receipt_rejected':
      return toStudent()
    case 'accepted_paid':
      await toStudent()
      return toStaff(registrarEmails(admin), 'registrar')
  }
}

function deliver(recipients: { to?: string[]; bcc?: string[] }, m: ComposedEmail) {
  return sendEmail({ ...recipients, subject: m.subject, text: m.text, html: m.html })
}

async function registrarEmails(admin: Admin): Promise<string[]> {
  const { data } = await admin.from('profiles').select('email').eq('role', 'registrar').eq('is_active', true)
  return (data ?? []).map((p) => p.email as string)
}

async function programHeadEmails(admin: Admin, departmentId: string | null): Promise<string[]> {
  const { data } = await admin.from('profiles').select('email, department_id').eq('role', 'program_head').eq('is_active', true)
  return (data ?? [])
    .filter((p) => !p.department_id || p.department_id === departmentId)
    .map((p) => p.email as string)
}

async function teacherEmails(admin: Admin, teacherId: string | null): Promise<string[]> {
  if (!teacherId) return []
  const { data } = await admin.from('profiles').select('email').eq('id', teacherId).eq('is_active', true).maybeSingle()
  return data?.email ? [data.email as string] : []
}

/** The site the action was performed on, so a local test links to localhost, a
 *  Vercel preview to that preview, and the live site to itself. Allowed inside
 *  after() when called from a Server Action (Next's after() docs). */
async function siteUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
