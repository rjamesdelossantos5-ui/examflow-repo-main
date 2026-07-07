import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Email notifications via Resend's REST API (no SDK dependency — a plain fetch
// works fine from a Server Action). Everything here is best-effort: if email
// isn't configured, or a send fails, we log and move on so the underlying
// request (submit / verify / approve) is never blocked or broken by email.
//
// Required env to actually send:
//   RESEND_API_KEY            — from resend.com
//   EMAIL_FROM                — e.g. "EXAMFLOW <noreply@yourdomain>"
//   SUPABASE_SERVICE_ROLE_KEY — needed to look up staff emails (see admin.ts)
// Optional:
//   NEXT_PUBLIC_APP_URL       — site URL, used to add a "Open EXAMFLOW" button

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''

const EXAM_TYPE_LABEL: Record<string, string> = { paid: 'Paid', excused: 'Excused' }

async function send(to: string[], subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const recipients = [...new Set(to.filter(Boolean))]
  if (!key || !from || recipients.length === 0) return

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    })
    if (!res.ok) {
      console.error('[email] Resend responded', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[email] send failed', err)
  }
}

// Minimal branded HTML shell. Email clients strip <style>/classes, so every
// style is inline. `path` (e.g. "/registrar") turns into an "Open" button when
// NEXT_PUBLIC_APP_URL is set.
function template(heading: string, lines: string[], path: string): string {
  const rows = lines
    .map((l) => `<p style="margin:0 0 8px;color:#334155;font-size:15px;line-height:1.5">${l}</p>`)
    .join('')
  const button = APP_URL
    ? `<a href="${APP_URL}${path}" style="display:inline-block;margin-top:20px;background:#f5b800;color:#0a2540;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:8px">Open EXAMFLOW</a>`
    : ''
  return `
  <div style="background:#f1f5f9;padding:28px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#0a2540;padding:18px 24px">
        <span style="color:#ffffff;font-weight:800;font-size:18px;letter-spacing:.5px">EXAM<span style="color:#f5b800">FLOW</span></span>
      </div>
      <div style="padding:24px">
        <h1 style="margin:0 0 14px;color:#0a2540;font-size:18px">${heading}</h1>
        ${rows}
        ${button}
      </div>
      <div style="padding:14px 24px;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:12px">Automated notice from EXAMFLOW — STI College Special Exam Requests. Please don't reply to this email.</p>
      </div>
    </div>
  </div>`
}

async function subjectLabel(admin: NonNullable<ReturnType<typeof createAdminClient>>, subjectId: string): Promise<string> {
  const { data } = await admin.from('subjects').select('subject_code, subject_name').eq('id', subjectId).maybeSingle()
  if (!data) return 'a subject'
  return `${data.subject_name} (${data.subject_code})`
}

async function emailsForRole(admin: NonNullable<ReturnType<typeof createAdminClient>>, role: string): Promise<string[]> {
  const { data } = await admin.from('profiles').select('email').eq('role', role).eq('is_active', true)
  return (data ?? []).map((r) => r.email as string).filter(Boolean)
}

// Student submitted (or resubmitted) — the registrars verify next.
export async function notifyNewSubmission(info: { studentName: string; subjectId: string; examType: string; resubmit?: boolean }): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return
  const [recipients, subject] = await Promise.all([emailsForRole(admin, 'registrar'), subjectLabel(admin, info.subjectId)])
  if (recipients.length === 0) return
  const verb = info.resubmit ? 'resubmitted' : 'submitted'
  await send(
    recipients,
    `New special exam request — ${info.studentName}`,
    template(
      'A special exam request needs verification',
      [
        `<strong>${info.studentName}</strong> ${verb} a ${EXAM_TYPE_LABEL[info.examType] ?? info.examType} special exam request.`,
        `Subject: <strong>${subject}</strong>`,
        'Please review and verify it in the Registrar queue.',
      ],
      '/registrar',
    ),
  )
}

// Registrar verified — routes to a specific subject teacher.
export async function notifyRequestVerified(info: { teacherId: string | null; studentName: string; subjectId: string }): Promise<void> {
  const admin = createAdminClient()
  if (!admin || !info.teacherId) return
  const { data: teacher } = await admin.from('profiles').select('email, is_active').eq('id', info.teacherId).maybeSingle()
  if (!teacher?.email || teacher.is_active === false) return
  const subject = await subjectLabel(admin, info.subjectId)
  await send(
    [teacher.email as string],
    `Special exam request to review — ${info.studentName}`,
    template(
      'A verified request is waiting for your approval',
      [
        `The Registrar verified <strong>${info.studentName}</strong>'s special exam request.`,
        `Subject: <strong>${subject}</strong>`,
        'Please review it in your Teacher queue.',
      ],
      '/teacher',
    ),
  )
}

// One teacher, several verified forms (bulk "Verify all").
export async function notifyTeacherVerifiedMany(info: { teacherId: string | null; studentName: string; count: number }): Promise<void> {
  const admin = createAdminClient()
  if (!admin || !info.teacherId || info.count < 1) return
  const { data: teacher } = await admin.from('profiles').select('email, is_active').eq('id', info.teacherId).maybeSingle()
  if (!teacher?.email || teacher.is_active === false) return
  await send(
    [teacher.email as string],
    `${info.count} special exam request${info.count === 1 ? '' : 's'} to review — ${info.studentName}`,
    template(
      'Verified requests are waiting for your approval',
      [
        `The Registrar verified <strong>${info.count}</strong> of <strong>${info.studentName}</strong>'s special exam requests.`,
        'Please review them in your Teacher queue.',
      ],
      '/teacher',
    ),
  )
}

// Teacher approved — program heads give final acceptance.
export async function notifyRequestApproved(info: { studentName: string; count?: number }): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return
  const recipients = await emailsForRole(admin, 'program_head')
  if (recipients.length === 0) return
  const n = info.count ?? 1
  await send(
    recipients,
    `Approved special exam request — ${info.studentName}`,
    template(
      'A request is ready for final acceptance',
      [
        `The Subject Teacher approved <strong>${n}</strong> special exam request${n === 1 ? '' : 's'} for <strong>${info.studentName}</strong>.`,
        'Please review and accept in your Program Head queue.',
      ],
      '/program-head',
    ),
  )
}
