import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Sends EXAMFLOW's notification emails from the project's own Gmail account
 * (GMAIL_USER, e.g. examflow.sti@gmail.com) through Gmail's SMTP server.
 *
 * Why Gmail: the school declined automated sending from its Microsoft 365
 * account (2026-09-27), and email services such as Resend and Brevo only send
 * from a domain you own. Gmail needs neither — only 2-Step Verification on the
 * account and an app password (support.google.com/accounts/answer/185833).
 * A personal Gmail account stops sending after 500 emails in a day
 * (support.google.com/mail/answer/22839).
 *
 * Vercel allows it: "Vercel doesn't block outgoing SMTP connections except on
 * port 25" (vercel.com/kb/guide/serverless-functions-and-smtp). Port 465 is
 * used here. It must run on the Node.js runtime — the Edge runtime has no
 * sockets — which is the default for Server Actions.
 *
 * Best-effort by design: this never throws. A failed email is logged and the
 * action that triggered it still stands; the in-app bell is the record.
 */

// Short enough that a stuck connection gives up well within the function's
// time limit, long enough for Gmail's greeting and login.
const TIMEOUT_MS = 10_000

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER
  // Google shows app passwords in groups of four ("abcd efgh ijkl mnop"); the
  // spaces are only for reading, so they are removed.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')
  if (!user || !pass) return null
  transporter ??= nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  })
  return transporter
}

export interface EmailMessage {
  /** Recipients who may see each other (a single student, or a single teacher). */
  to?: string[]
  /** Recipients who should not see each other's addresses (a group of staff). */
  bcc?: string[]
  subject: string
  text: string
  html: string
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const to = (msg.to ?? []).filter(Boolean)
  const bcc = (msg.bcc ?? []).filter(Boolean)
  if (!to.length && !bcc.length) return

  const t = getTransporter()
  if (!t) {
    console.warn('[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipped:', msg.subject)
    return
  }

  try {
    await t.sendMail({
      from: `EXAMFLOW <${process.env.GMAIL_USER}>`,
      // A Bcc-only message still needs a To; the sender's own address is used.
      to: to.length ? to : process.env.GMAIL_USER,
      bcc: bcc.length ? bcc : undefined,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    })
  } catch (err) {
    console.error('[email] send failed:', msg.subject, err)
  }
}
