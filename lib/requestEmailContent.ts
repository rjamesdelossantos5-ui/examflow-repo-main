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
  page: '#EEF2F7',
  card: '#FFFFFF',
  soft: '#F8FAFC',
  text: '#1F2937',
  muted: '#6B7280',
  line: '#E5E7EB',
  headerSub: '#C7D2E3',
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

<tr><td style="background:${COLOR.navy};border-radius:14px 14px 0 0;padding:20px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;background:${COLOR.gold};border-radius:20px;font-family:${FONT};font-size:15px;font-weight:800;line-height:40px;color:${COLOR.navy};">EF</td>
<td style="padding-left:12px;font-family:${FONT};">
<div style="font-size:18px;font-weight:800;letter-spacing:1px;line-height:1.2;color:#FFFFFF;">EXAMFLOW</div>
<div style="font-size:12px;line-height:1.4;color:${COLOR.headerSub};">Special Exam Request System</div>
</td>
</tr></table>
</td></tr>
<tr><td style="background:${COLOR.gold};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

<tr><td style="background:${COLOR.card};padding:28px 28px 8px;font-family:${FONT};color:${COLOR.text};">
<span style="display:inline-block;background:${tone.bg};color:${tone.fg};font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;line-height:1;padding:7px 11px;border-radius:999px;">${e(c.badge)}</span>
<h1 style="margin:16px 0 0;font-size:22px;line-height:1.3;font-weight:800;color:${COLOR.navy};">${e(c.heading)}</h1>
<p style="margin:18px 0 0;font-size:15px;line-height:1.6;">${e(c.greeting)}</p>
${c.paragraphs.map((p) => `<p style="margin:10px 0 0;font-size:15px;line-height:1.6;">${e(p)}</p>`).join('\n')}
${c.callout ? calloutHtml(c.callout, tone) : ''}
</td></tr>

${c.stage ? `<tr><td style="background:${COLOR.card};padding:22px 28px 4px;">${stepsHtml(steps(r, c.stage), c.tone)}</td></tr>` : ''}
${c.schedule ? `<tr><td style="background:${COLOR.card};padding:18px 28px 0;">${cardHtml('Exam schedule', c.schedule, true)}</td></tr>` : ''}
<tr><td style="background:${COLOR.card};padding:18px 28px 0;">${cardHtml('Request details', details, false)}</td></tr>

<tr><td style="background:${COLOR.card};padding:24px 28px 28px;font-family:${FONT};">
${buttonHtml(c.button.label, c.button.url)}
${c.next ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:${COLOR.text};"><strong style="color:${COLOR.navy};">What happens next:</strong> ${e(c.next)}</p>` : ''}
<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:${COLOR.muted};">Button not working? Open this link:<br><a href="${e(c.button.url)}" style="color:${COLOR.navy};word-break:break-all;">${e(c.button.url)}</a></p>
</td></tr>

<tr><td style="background:${COLOR.soft};border-top:1px solid ${COLOR.line};border-radius:0 0 14px 14px;padding:18px 28px;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLOR.muted};">
You are receiving this because of your part in a special exam request on EXAMFLOW.<br>
This is an automated message from EXAMFLOW.
</td></tr>

</table>
<p style="margin:16px 0 0;font-family:${FONT};font-size:11px;line-height:1.5;color:${COLOR.muted};">EXAMFLOW · Special Exam Request System · STI College Sta. Maria</p>
</td></tr>
</table>
</body>
</html>`
}

function calloutHtml(c: Row, tone: { bg: string; fg: string; bar: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
<tr><td style="background:${tone.bg};border-left:4px solid ${tone.bar};border-radius:8px;padding:12px 16px;font-family:${FONT};">
<div style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${tone.fg};">${e(c.label)}</div>
<div style="margin-top:4px;font-size:14px;line-height:1.5;color:${COLOR.text};">${e(c.value || '—')}</div>
</td></tr></table>`
}

function stepsHtml(s: { labels: string[]; current: number }, tone: Tone): string {
  const width = Math.floor(100 / s.labels.length)
  const cells = s.labels
    .map((label, i) => {
      const done = i < s.current
      const current = i === s.current
      const bg = done ? COLOR.navy : current ? (tone === 'danger' || tone === 'warning' ? TONES[tone].bar : COLOR.gold) : '#FFFFFF'
      const border = done || current ? bg : '#CBD5E1'
      const color = done ? '#FFFFFF' : current ? (tone === 'danger' || tone === 'warning' ? '#FFFFFF' : COLOR.navy) : '#94A3B8'
      const mark = done ? '&#10003;' : String(i + 1)
      const labelColor = current ? COLOR.navy : done ? COLOR.text : '#94A3B8'
      return `<td width="${width}%" align="center" valign="top" style="padding:0 2px;font-family:${FONT};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td width="26" height="26" align="center" valign="middle" style="width:24px;height:24px;background:${bg};border:1px solid ${border};border-radius:13px;font-size:12px;font-weight:700;line-height:24px;color:${color};">${mark}</td>
</tr></table>
<div style="margin-top:6px;font-size:11px;line-height:1.3;font-weight:${current ? 700 : 500};color:${labelColor};">${e(label)}</div>
</td>`
    })
    .join('\n')
  return `<div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${COLOR.muted};margin-bottom:12px;">Progress</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${cells}
</tr></table>`
}

function cardHtml(title: string, rows: Row[], highlight: boolean): string {
  if (!rows.length) return ''
  const bg = highlight ? '#FFFBEB' : COLOR.soft
  const edge = highlight ? `border-left:4px solid ${COLOR.gold};` : ''
  const body = rows
    .map(
      (r, i) => `<tr>
<td valign="top" style="padding:${i === 0 ? 4 : 6}px 12px ${i === rows.length - 1 ? 14 : 6}px 16px;width:34%;font-family:${FONT};font-size:13px;line-height:1.5;color:${COLOR.muted};">${e(r.label)}</td>
<td valign="top" style="padding:${i === 0 ? 4 : 6}px 16px ${i === rows.length - 1 ? 14 : 6}px 0;font-family:${FONT};font-size:13px;line-height:1.5;font-weight:600;color:${COLOR.text};">${e(r.value)}</td>
</tr>`,
    )
    .join('\n')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border:1px solid ${COLOR.line};${edge}border-radius:10px;border-collapse:separate;">
<tr><td colspan="2" style="padding:14px 16px 6px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${COLOR.muted};">${e(title)}</td></tr>
${body}
</table>`
}

function buttonHtml(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${COLOR.navy}" style="background:${COLOR.navy};border-radius:8px;">
<a href="${e(url)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:8px;">${e(label)} &rarr;</a>
</td>
</tr></table>`
}

// ── plain text (for mail apps that don't show HTML) ─────────────────────────

function renderText(c: Content, r: RequestEmailInfo): string {
  const block = (title: string, rows: Row[]) =>
    rows.length ? `${title.toUpperCase()}\n${rows.map((x) => `${x.label}: ${x.value}`).join('\n')}` : ''
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
