/**
 * What each EXAMFLOW notification email says and how it looks. Pure — no
 * database, no sending, no imports — so it can be rendered on its own for a
 * preview. lib/requestEmails.ts looks up the request and the recipients, then
 * sends what this builds.
 *
 * Email HTML is not web HTML. Outlook for Windows lays mail out with Word's
 * engine and many mail apps drop <style> blocks, so the layout is tables with
 * inline styles only. The logo is drawn in HTML rather than an image: Outlook
 * blocks remote images until the reader allows them, and a text logo shows at
 * once. Colours are the app's own (--sti-navy, --sti-gold in app/globals.css).
 */

export type RequestEmailEvent =
  | 'submitted'          // student pressed Submit → Registrar verifies
  | 'reverified'         // parent verified again after a Program Head return → Program Head
  | 'registrar_verified' // → Teacher, and Student (progress update)
  | 'teacher_approved'   // → Program Head (first approval), and Student (progress update)
  | 'rejected'           // any reviewer → Student
  | 'returned'           // Program Head returned it for re-verification → Student
  | 'accepted_paid'      // → Student (fee assessment next) and Registrar (assess fees)
  | 'fees_assessed'      // Registrar assessed the fees → Student (pay, then upload the receipt). One per student; `reason` carries the total
  | 'scheduled'          // excused accepted, or receipt confirmed → Student
  | 'receipt_uploaded'   // → Program Head (second approval)
  | 'receipt_rejected'   // → Student

/** Who the email is for. Staff emails go out as one Bcc message per group. */
export type Audience = 'student' | 'registrar' | 'teacher' | 'program_head'

/** Everything shown in the email, already read from the request. */
export interface RequestEmailInfo {
  id: string
  studentName: string
  studentNumber: string | null
  course: string | null
  yearLevel: number | null
  section: string | null
  code: string
  subjectName: string
  teacherName: string | null
  examType: 'paid' | 'excused' | null
  excusedReason: string | null
  otherReason: string | null
  /** e.g. "Midterms · 2026-2027", already labelled by the caller. */
  termLabel: string | null
  submittedAt: string | null
  examStart: string | null
  examEnd: string | null
  examLocation: string | null
  examBring: string | null
}

export interface ComposedEmail {
  subject: string
  html: string
  text: string
}

type Tone = 'action' | 'info' | 'success' | 'danger' | 'warning'
type Stage = 'registrar' | 'teacher' | 'program_head' | 'payment' | 'exam'

interface Row {
  label: string
  value: string
}

interface Content {
  subject: string
  tone: Tone
  badge: string
  heading: string
  greeting: string
  paragraphs: string[]
  callout?: Row
  stage?: Stage
  schedule?: Row[]
  button: { label: string; url: string }
  next?: string
}

const COLOR = {
  navy: '#002F6C',
  gold: '#FDB913',
  page: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1F2937',
  muted: '#6B7280',
  line: '#D5DCE6',
}

const TONES: Record<Tone, { bg: string; fg: string; bar: string }> = {
  action: { bg: '#FEF3C7', fg: '#92400E', bar: '#FDB913' },
  info: { bg: '#DBEAFE', fg: '#1E40AF', bar: '#2563EB' },
  success: { bg: '#DCFCE7', fg: '#166534', bar: '#16A34A' },
  danger: { bg: '#FEE2E2', fg: '#991B1B', bar: '#DC2626' },
  warning: { bg: '#FFEDD5', fg: '#9A3412', bar: '#EA580C' },
}

// Same labels as the submit form (app/student/submit/SubmitForm.tsx).
const EXCUSED_LABEL: Record<string, string> = {
  medical: 'Medical',
  bereavement: 'Bereavement',
  other: 'Other',
}

const FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function composeRequestEmail(
  event: RequestEmailEvent,
  audience: Audience,
  r: RequestEmailInfo,
  base: string,
  reason = '',
): ComposedEmail {
  const c = content(event, audience, r, base, reason)
  return { subject: c.subject, html: renderHtml(c, r), text: renderText(c, r) }
}

function content(event: RequestEmailEvent, audience: Audience, r: RequestEmailInfo, base: string, reason: string): Content {
  const title = `${r.code}${r.subjectName ? ` ${r.subjectName}` : ''}`
  const studentLink = `${base}/student/requests/${r.id}`
  const hiStudent = `Hi ${r.studentName},`
  const needed = { tone: 'action' as const, badge: 'Action needed' }

  switch (event) {
    case 'submitted':
      return {
        ...needed,
        subject: `New special exam request: ${r.studentName} — ${r.code}`,
        heading: 'New request to verify',
        greeting: 'Hello,',
        paragraphs: [
          `${r.studentName} submitted a special exam request for ${title}.`,
          'Their parent or guardian has been verified. It is waiting for you to verify it.',
        ],
        stage: 'registrar',
        button: { label: 'Verify request', url: `${base}/registrar?req=${r.id}` },
        next: 'Once you verify it, the subject teacher is asked to approve it.',
      }

    case 'reverified':
      return {
        ...needed,
        subject: `Re-verified: ${r.studentName} — ${r.code}`,
        heading: 'Parent verified again',
        greeting: 'Hello,',
        paragraphs: [
          `The parent or guardian of ${r.studentName} verified their identity again for ${title}.`,
          'The request is back in your First Approval queue. Please check the new photos.',
        ],
        stage: 'program_head',
        button: { label: 'Review request', url: `${base}/program-head?req=${r.id}` },
      }

    case 'registrar_verified':
      if (audience === 'student') {
        return {
          tone: 'info',
          badge: 'Verified',
          subject: `Update: the Registrar verified your request for ${r.code}`,
          heading: 'The Registrar verified your request',
          greeting: hiStudent,
          paragraphs: [
            `The Registrar verified your special exam request for ${title}.`,
            'It is now waiting for your subject teacher’s approval.',
          ],
          stage: 'teacher',
          button: { label: 'View request', url: studentLink },
          next: 'You don’t need to do anything right now. You’ll get an email when your teacher decides.',
        }
      }
      return {
        ...needed,
        subject: `Waiting for your approval: ${r.studentName} — ${r.code}`,
        heading: 'Waiting for your approval',
        greeting: r.teacherName ? `Hi ${r.teacherName},` : 'Hello,',
        paragraphs: [
          `The Registrar verified ${r.studentName}'s special exam request for ${title}.`,
          'It is waiting for your approval.',
        ],
        stage: 'teacher',
        button: { label: 'Review request', url: `${base}/teacher?req=${r.id}` },
        next: 'Once you approve it, it goes to the Program Head for first approval.',
      }

    case 'teacher_approved':
      if (audience === 'student') {
        return {
          tone: 'info',
          badge: 'Approved by teacher',
          subject: `Update: your teacher approved your request for ${r.code}`,
          heading: 'Your teacher approved your request',
          greeting: hiStudent,
          paragraphs: [
            `Your subject teacher approved your special exam request for ${title}.`,
            'It is now with the Program Head for first approval.',
          ],
          stage: 'program_head',
          button: { label: 'View request', url: studentLink },
          next: 'You don’t need to do anything right now. You’ll get an email when the Program Head decides.',
        }
      }
      return {
        ...needed,
        subject: `Waiting for first approval: ${r.studentName} — ${r.code}`,
        heading: 'Ready for first approval',
        greeting: 'Hello,',
        paragraphs: [
          `The subject teacher approved ${r.studentName}'s special exam request for ${title}.`,
          'Please check the parent’s ID and selfie, then accept, return or reject it.',
        ],
        stage: 'program_head',
        button: { label: 'Review request', url: `${base}/program-head?req=${r.id}` },
      }

    case 'rejected':
      return {
        tone: 'danger',
        badge: 'Rejected',
        subject: `Your special exam request for ${r.code} was rejected`,
        heading: 'Your request was rejected',
        greeting: hiStudent,
        paragraphs: [`Your special exam request for ${title} was rejected.`],
        callout: { label: 'Reason', value: reason },
        button: { label: 'View request', url: studentLink },
        next: 'You can fix it and resubmit — your details are kept.',
      }

    case 'returned':
      return {
        tone: 'warning',
        badge: 'Action needed',
        subject: `Action needed: your parent or guardian must verify again (${r.code})`,
        heading: 'Your parent or guardian needs to verify again',
        greeting: hiStudent,
        paragraphs: [`Your Program Head asked your parent or guardian to verify their identity again for ${title}.`],
        callout: { label: 'Reason', value: reason },
        stage: 'program_head',
        button: { label: 'Verify parent again', url: studentLink },
        next: 'Nothing on the form needs changing. Once they pass, press Submit and it goes straight back to the Program Head.',
      }

    case 'accepted_paid':
      if (audience === 'registrar') {
        return {
          ...needed,
          subject: `Fee assessment needed: ${r.studentName} — ${r.code}`,
          heading: 'Fee assessment needed',
          greeting: 'Hello,',
          paragraphs: [
            `The Program Head accepted ${r.studentName}'s paid special exam for ${title}.`,
            'Please assess the student’s fees.',
          ],
          stage: 'payment',
          button: { label: 'Assess fees', url: `${base}/registrar/assessment` },
        }
      }
      return {
        tone: 'success',
        badge: 'Accepted',
        subject: `Your special exam request for ${r.code} was accepted`,
        heading: 'Your request was accepted',
        greeting: hiStudent,
        paragraphs: [`Your special exam request for ${title} was accepted by the Program Head.`],
        stage: 'payment',
        button: { label: 'View request', url: studentLink },
        next: 'Go to the Registrar for your fee assessment, pay at the Cashier, then upload your receipt in EXAMFLOW.',
      }

    case 'fees_assessed':
      return {
        ...needed,
        subject: 'Your special exam fees are assessed',
        heading: 'Your fees are assessed',
        greeting: hiStudent,
        paragraphs: ['The Registrar assessed your special exam fees. You can now pay at the Cashier.'],
        callout: { label: 'Amount to pay', value: reason },
        stage: 'payment',
        button: { label: 'Upload receipt', url: studentLink },
        next: 'Pay at the Cashier, then upload a photo of your official receipt in EXAMFLOW.',
      }

    case 'scheduled': {
      const schedule = scheduleRows(r)
      return {
        tone: 'success',
        badge: 'Scheduled',
        subject: `Your special exam for ${r.code} is scheduled`,
        heading: 'Your special exam is scheduled',
        greeting: hiStudent,
        paragraphs: [
          `Your special exam for ${title} is scheduled.`,
          ...(schedule.length ? [] : ['Open EXAMFLOW for the date, the venue and what to bring.']),
        ],
        schedule: schedule.length ? schedule : undefined,
        stage: 'exam',
        button: { label: 'View request', url: studentLink },
      }
    }

    case 'receipt_uploaded':
      return {
        ...needed,
        subject: `Payment receipt to check: ${r.studentName} — ${r.code}`,
        heading: 'Payment receipt to check',
        greeting: 'Hello,',
        paragraphs: [
          `${r.studentName} uploaded a payment receipt for ${title}.`,
          'It is waiting in your Second Approval queue.',
        ],
        stage: 'payment',
        button: { label: 'Check receipt', url: `${base}/program-head/receipts?req=${r.id}` },
      }

    case 'receipt_rejected':
      return {
        tone: 'danger',
        badge: 'Not accepted',
        subject: `Your payment receipt for ${r.code} was not accepted`,
        heading: 'Your payment receipt was not accepted',
        greeting: hiStudent,
        paragraphs: [`Your payment receipt for ${title} was not accepted.`],
        callout: { label: 'Reason', value: reason },
        stage: 'payment',
        button: { label: 'Upload a new receipt', url: studentLink },
        next: 'Please upload a new receipt.',
      }
  }
}

// ── details ────────────────────────────────────────────────────────────────

function detailRows(r: RequestEmailInfo): Row[] {
  const rows: Array<Row | null> = [
    { label: 'Student', value: [r.studentName, r.studentNumber].filter(Boolean).join(' · ') },
    row('Course & section', [r.course, r.yearLevel ? `Year ${r.yearLevel}` : null, r.section].filter(Boolean).join(' · ')),
    { label: 'Subject', value: r.subjectName ? `${r.code} — ${r.subjectName}` : r.code },
    row('Teacher', r.teacherName),
    row('Exam type', examTypeLabel(r)),
    row('Term', r.termLabel),
    row('Submitted', manila(r.submittedAt)),
  ]
  return rows.filter((x): x is Row => x !== null)
}

function scheduleRows(r: RequestEmailInfo): Row[] {
  const rows: Array<Row | null> = [
    row('Date', examWhen(r.examStart, r.examEnd)),
    row('Venue', r.examLocation),
    row('Bring', r.examBring),
  ]
  return rows.filter((x): x is Row => x !== null)
}

function row(label: string, value: string | null | undefined): Row | null {
  const v = (value ?? '').trim()
  return v ? { label, value: v } : null
}

function examTypeLabel(r: RequestEmailInfo): string | null {
  if (r.examType === 'paid') return 'Paid'
  if (r.examType !== 'excused') return null
  const why = r.excusedReason ? EXCUSED_LABEL[r.excusedReason] ?? r.excusedReason : null
  const other = r.excusedReason === 'other' && r.otherReason ? `: ${r.otherReason}` : ''
  return why ? `Excused — ${why}${other}` : 'Excused'
}

/** Dates in the school's time zone, whatever the server's is. */
function manila(iso: string | null, opts: { time?: boolean; weekday?: boolean } = { time: true }): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: opts.weekday ? 'long' : undefined,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: opts.time ? 'numeric' : undefined,
    minute: opts.time ? '2-digit' : undefined,
  }).format(d)
}

function examWhen(start: string | null, end: string | null): string | null {
  const from = manila(start, { time: true, weekday: true })
  if (!from) return null
  const to = manila(end, { time: true, weekday: true })
  if (!to) return from
  const sameDay = manila(start, { time: false }) === manila(end, { time: false })
  const endTime = sameDay
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(new Date(end as string))
    : to
  return `${from} – ${endTime}`
}

function steps(r: RequestEmailInfo, stage: Stage): { labels: string[]; current: number } {
  const labels = ['Submitted', 'Registrar', 'Teacher', 'Program Head', ...(r.examType === 'paid' ? ['Payment'] : []), 'Exam']
  const name: Record<Stage, string> = {
    registrar: 'Registrar',
    teacher: 'Teacher',
    program_head: 'Program Head',
    payment: 'Payment',
    exam: 'Exam',
  }
  const current = labels.indexOf(name[stage])
  return { labels, current: current < 0 ? labels.length - 1 : current }
}

// ── HTML ───────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)
}

const e = escapeHtml

// Same world as the landing page (app/page.tsx): the navy bar with the text
// wordmark, white paper with hairline rules on a cool off-white page, navy
// ink. No logo badge, no caps labels, no tinted boxes — a plain letter.
function renderHtml(c: Content, r: RequestEmailInfo): string {
  const tone = TONES[c.tone]
  const details = detailRows(r)
  const preheader = c.paragraphs[0] ?? c.heading

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(c.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${e(preheader)}${'&nbsp;&zwnj;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.page};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;border:1px solid ${COLOR.line};border-radius:6px;border-collapse:separate;">

<tr><td style="background:${COLOR.navy};border-radius:6px 6px 0 0;padding:18px 32px;font-family:${FONT};font-size:18px;font-weight:800;line-height:1;color:#FFFFFF;">EXAM<span style="color:${COLOR.gold};">FLOW</span></td></tr>

<tr><td style="background:${COLOR.card};padding:32px 32px 0;font-family:${FONT};color:${COLOR.text};">
<p style="margin:0;font-size:13px;line-height:1.4;font-weight:600;color:${tone.fg};">${e(c.badge)}</p>
<h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;font-weight:800;color:${COLOR.navy};">${e(c.heading)}</h1>
<p style="margin:20px 0 0;font-size:15px;line-height:1.6;">${e(c.greeting)}</p>
${c.paragraphs.map((p) => `<p style="margin:10px 0 0;font-size:15px;line-height:1.6;">${e(p)}</p>`).join('\n')}
${c.callout ? calloutHtml(c.callout) : ''}
</td></tr>

${c.stage ? `<tr><td style="background:${COLOR.card};padding:28px 32px 0;">${stepsHtml(steps(r, c.stage), c.tone)}</td></tr>` : ''}
${c.schedule ? `<tr><td style="background:${COLOR.card};padding:28px 32px 0;">${rowsHtml('Exam schedule', c.schedule)}</td></tr>` : ''}
<tr><td style="background:${COLOR.card};padding:28px 32px 0;">${rowsHtml('Request details', details)}</td></tr>

<tr><td style="background:${COLOR.card};padding:28px 32px 32px;font-family:${FONT};">
${c.next ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${COLOR.text};"><strong style="color:${COLOR.navy};">Next:</strong> ${e(c.next)}</p>` : ''}
${buttonHtml(c.button.label, c.button.url)}
</td></tr>

<tr><td style="background:${COLOR.card};border-top:1px solid ${COLOR.line};border-radius:0 0 6px 6px;padding:16px 32px;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLOR.muted};">
Automated message from EXAMFLOW, the special exam request system of STI College Sta. Maria.
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

/** The one thing to notice (a reason, an amount): a label and its value between two rules. */
function calloutHtml(c: Row): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid ${COLOR.line};border-bottom:1px solid ${COLOR.line};">
<tr><td style="padding:14px 0;font-family:${FONT};">
<div style="font-size:13px;line-height:1.4;color:${COLOR.muted};">${e(c.label)}</div>
<div style="margin-top:4px;font-size:16px;line-height:1.5;font-weight:700;color:${COLOR.navy};">${e(c.value || '—')}</div>
</td></tr></table>`
}

/** "Step 4 of 6 · Program Head" over a thin segmented bar: done navy, current gold. */
function stepsHtml(s: { labels: string[]; current: number }, tone: Tone): string {
  const currentColor = tone === 'danger' || tone === 'warning' ? TONES[tone].bar : COLOR.gold
  const cells = s.labels
    .map((_, i) => {
      const bg = i < s.current ? COLOR.navy : i === s.current ? currentColor : COLOR.line
      return `<td style="padding:0 ${i === s.labels.length - 1 ? 0 : 3}px 0 0;"><div style="height:4px;line-height:4px;font-size:0;background:${bg};border-radius:2px;">&nbsp;</div></td>`
    })
    .join('')
  return `<p style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.4;color:${COLOR.muted};">Step ${s.current + 1} of ${s.labels.length} <span style="color:${COLOR.text};font-weight:600;">· ${e(s.labels[s.current])}</span></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`
}

/** A heading, then label–value rows separated by hairlines. */
function rowsHtml(title: string, rows: Row[]): string {
  if (!rows.length) return ''
  const body = rows
    .map(
      (r) => `<tr>
<td valign="top" style="padding:9px 12px 9px 0;width:34%;border-top:1px solid ${COLOR.line};font-family:${FONT};font-size:14px;line-height:1.5;color:${COLOR.muted};">${e(r.label)}</td>
<td valign="top" style="padding:9px 0;border-top:1px solid ${COLOR.line};font-family:${FONT};font-size:14px;line-height:1.5;color:${COLOR.text};">${e(r.value)}</td>
</tr>`,
    )
    .join('\n')
  return `<p style="margin:0 0 8px;font-family:${FONT};font-size:15px;line-height:1.4;font-weight:700;color:${COLOR.navy};">${e(title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid ${COLOR.line};">
${body}
</table>`
}

function buttonHtml(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${COLOR.navy}" style="background:${COLOR.navy};border-radius:4px;">
<a href="${e(url)}" target="_blank" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:4px;">${e(label)}</a>
</td>
</tr></table>`
}

// ── plain text (for mail apps that don't show HTML) ─────────────────────────

function renderText(c: Content, r: RequestEmailInfo): string {
  const block = (title: string, rows: Row[]) =>
    rows.length ? `${title}\n${rows.map((x) => `${x.label}: ${x.value}`).join('\n')}` : ''
  return [
    `EXAMFLOW — ${c.heading}`,
    c.greeting,
    ...c.paragraphs,
    c.callout ? `${c.callout.label}: ${c.callout.value}` : '',
    c.schedule ? block('Exam schedule', c.schedule) : '',
    block('Request details', detailRows(r)),
    c.next ? `What happens next: ${c.next}` : '',
    `${c.button.label}: ${c.button.url}`,
    'This is an automated message from EXAMFLOW.',
  ]
    .filter(Boolean)
    .join('\n\n')
}
