import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

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
 *  - Student: the request's owner.
 * Parents get nothing: EXAMFLOW has no parent email address on file.
 *
 * Looked up with the service-role client, because the person acting (say, a
 * student pressing Submit) cannot read other users' profiles. Only email
 * addresses and the names already shown on the request are read.
 */

export type RequestEmailEvent =
  | 'submitted'          // student pressed Submit → Registrar verifies
  | 'reverified'         // parent verified again after a Program Head return → Program Head
  | 'registrar_verified' // → Teacher
  | 'teacher_approved'   // → Program Head (first approval)
  | 'rejected'           // any reviewer → Student
  | 'returned'           // Program Head returned it for re-verification → Student
  | 'accepted_paid'      // → Student (fee assessment next) and Registrar (assess fees)
  | 'scheduled'          // excused accepted, or receipt confirmed → Student
  | 'receipt_uploaded'   // → Program Head (second approval)
  | 'receipt_rejected'   // → Student

type Admin = NonNullable<ReturnType<typeof createAdminClient>>

interface RequestInfo {
  id: string
  studentName: string
  studentEmail: string | null
  code: string
  subjectName: string
  departmentId: string | null
  teacherId: string | null
}

interface Letter {
  subject: string
  lines: string[]
  link: string
}

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

    const { data, error } = await admin
      .from('special_exam_requests')
      .select('id, teacher_id, snap_name, student:profiles!student_id(full_name, email), subject:subjects(subject_code, subject_name, department_id, teacher_id)')
      .in('id', ids)
    if (error || !data) {
      console.error('[requestEmails] could not read the requests', event, error)
      return
    }

    for (const row of data) {
      const student = row.student as unknown as { full_name: string; email: string } | null
      const subject = row.subject as unknown as { subject_code: string; subject_name: string; department_id: string | null; teacher_id: string | null } | null
      const info: RequestInfo = {
        id: row.id as string,
        studentName: (row.snap_name as string | null) ?? student?.full_name ?? 'A student',
        studentEmail: student?.email ?? null,
        code: subject?.subject_code ?? 'a subject',
        subjectName: subject?.subject_name ?? '',
        departmentId: subject?.department_id ?? null,
        teacherId: (row.teacher_id as string | null) ?? subject?.teacher_id ?? null,
      }
      await send(admin, event, info, base, opts.reason ?? '')
    }
  } catch (err) {
    console.error('[requestEmails]', event, err)
  }
}

async function send(admin: Admin, event: RequestEmailEvent, r: RequestInfo, base: string, reason: string) {
  const title = `${r.code}${r.subjectName ? ` ${r.subjectName}` : ''}`
  const student = (letter: Letter) => deliver({ to: r.studentEmail ? [r.studentEmail] : [] }, letter)
  const staff = async (emails: Promise<string[]>, letter: Letter) => deliver({ bcc: await emails }, letter)

  switch (event) {
    case 'submitted':
      return staff(registrarEmails(admin), {
        subject: `New special exam request: ${r.studentName} — ${r.code}`,
        lines: [
          `${r.studentName} submitted a special exam request for ${title}.`,
          'Their parent or guardian has been verified. It is waiting for you to verify it.',
        ],
        link: `${base}/registrar?req=${r.id}`,
      })

    case 'reverified':
      return staff(programHeadEmails(admin, r.departmentId), {
        subject: `Re-verified: ${r.studentName} — ${r.code}`,
        lines: [
          `The parent or guardian of ${r.studentName} verified their identity again for ${title}.`,
          'The request is back in your First Approval queue. Please check the new photos.',
        ],
        link: `${base}/program-head?req=${r.id}`,
      })

    case 'registrar_verified':
      return staff(teacherEmails(admin, r.teacherId), {
        subject: `Waiting for your approval: ${r.studentName} — ${r.code}`,
        lines: [
          `The Registrar verified ${r.studentName}'s special exam request for ${title}.`,
          'It is waiting for your approval.',
        ],
        link: `${base}/teacher?req=${r.id}`,
      })

    case 'teacher_approved':
      return staff(programHeadEmails(admin, r.departmentId), {
        subject: `Waiting for first approval: ${r.studentName} — ${r.code}`,
        lines: [
          `The subject teacher approved ${r.studentName}'s special exam request for ${title}.`,
          'Please check the parent’s ID and selfie, then accept, return or reject it.',
        ],
        link: `${base}/program-head?req=${r.id}`,
      })

    case 'rejected':
      return student({
        subject: `Your special exam request for ${r.code} was rejected`,
        lines: [
          `Your special exam request for ${title} was rejected.`,
          `Reason: ${reason}`,
          'You can fix it and resubmit — your details are kept.',
        ],
        link: `${base}/student/requests/${r.id}`,
      })

    case 'returned':
      return student({
        subject: `Action needed: your parent or guardian must verify again (${r.code})`,
        lines: [
          `Your Program Head asked your parent or guardian to verify their identity again for ${title}.`,
          `Reason: ${reason}`,
          'Nothing on the form needs changing. Once they pass, press Submit and it goes straight back to the Program Head.',
        ],
        link: `${base}/student/requests/${r.id}`,
      })

    case 'accepted_paid':
      await student({
        subject: `Your special exam request for ${r.code} was accepted`,
        lines: [
          `Your special exam request for ${title} was accepted by the Program Head.`,
          'Next: go to the Registrar for your fee assessment, pay at the Cashier, then upload your receipt in EXAMFLOW.',
        ],
        link: `${base}/student/requests/${r.id}`,
      })
      return staff(registrarEmails(admin), {
        subject: `Fee assessment needed: ${r.studentName} — ${r.code}`,
        lines: [
          `The Program Head accepted ${r.studentName}'s paid special exam for ${title}.`,
          'Please assess the student’s fees.',
        ],
        link: `${base}/registrar/assessment`,
      })

    case 'scheduled':
      return student({
        subject: `Your special exam for ${r.code} is scheduled`,
        lines: [
          `Your special exam for ${title} is scheduled.`,
          'Open EXAMFLOW for the date, the venue and what to bring.',
        ],
        link: `${base}/student/requests/${r.id}`,
      })

    case 'receipt_uploaded':
      return staff(programHeadEmails(admin, r.departmentId), {
        subject: `Payment receipt to check: ${r.studentName} — ${r.code}`,
        lines: [
          `${r.studentName} uploaded a payment receipt for ${title}.`,
          'It is waiting in your Second Approval queue.',
        ],
        link: `${base}/program-head/receipts?req=${r.id}`,
      })

    case 'receipt_rejected':
      return student({
        subject: `Your payment receipt for ${r.code} was not accepted`,
        lines: [
          `Your payment receipt for ${title} was not accepted.`,
          `Reason: ${reason}`,
          'Please upload a new receipt.',
        ],
        link: `${base}/student/requests/${r.id}`,
      })
  }
}

function deliver(recipients: { to?: string[]; bcc?: string[] }, l: Letter) {
  const footer = 'This is an automated message from EXAMFLOW.'
  return sendEmail({
    ...recipients,
    subject: l.subject,
    text: [...l.lines, `Open EXAMFLOW: ${l.link}`, footer].join('\n\n'),
    html:
      l.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('') +
      `<p><a href="${escapeHtml(l.link)}">Open EXAMFLOW</a></p>` +
      `<p style="color:#6b7280;font-size:12px">${footer}</p>`,
  })
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
