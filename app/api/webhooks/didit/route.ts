import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyWebhookSignature,
  summarizeDecision,
  statusLabel,
  isTerminal,
  type DiditDecision,
} from '@/lib/didit'

/**
 * Didit webhook receiver — the ONLY trustworthy source of a verification result.
 *
 * The parent also returns to us through a browser redirect carrying
 * `?status=Approved`, but Didit's own docs call those query params "untrusted UI
 * hints": anyone can retype the URL. Nothing here reads them. The database is
 * written from this signed webhook, or from a server-side re-fetch of the
 * decision — never from the browser.
 *
 * Two things about this route are easy to get wrong:
 *
 *  1. proxy.ts would eat it. Its matcher covers every non-static path, and a
 *     webhook carries no Supabase session cookie, so `user` is null and the
 *     request would be 307'd to /login — Didit would see a redirect, the
 *     handler would never run, and requests would sit unverified forever with
 *     no error anywhere. proxy.ts has an explicit exception for this path.
 *
 *  2. It cannot use the normal RLS-bound client. There is no auth.uid() here, so
 *     it matches no policy on special_exam_requests. It writes with the
 *     service-role client, which is why SUPABASE_SERVICE_ROLE_KEY is mandatory.
 */

/** Didit's webhook envelope. Everything is optional defensively — a workflow
 *  change on their side must produce a handled 200, never a thrown 500 that
 *  triggers pointless retries. */
interface DiditWebhookPayload {
  event_id?: string
  session_id?: string
  status?: string
  webhook_type?: string
  timestamp?: number
  created_at?: number
  vendor_data?: string
  decision?: DiditDecision
}

export async function POST(request: Request) {
  // The raw bytes, untouched. Must be read BEFORE any JSON parsing: the HMAC is
  // computed over exactly these bytes, and re-stringifying a parsed object
  // reorders keys and rewrites number formatting, which invalidates it.
  const rawBody = await request.text()

  const check = verifyWebhookSignature(
    rawBody,
    request.headers.get('x-signature'),
    request.headers.get('x-timestamp'),
  )
  if (!check.ok) {
    // Log the body so a signature failure is debuggable — this is the failure
    // mode of a mistyped DIDIT_WEBHOOK_SECRET, and without the body you are
    // guessing. 401 is deliberate: Didit retries 5xx and 404, and a bad
    // signature will not fix itself on a retry.
    console.error('[didit:webhook] rejected —', check.reason, '| body:', rawBody.slice(0, 1000))
    return new Response('invalid signature', { status: 401 })
  }

  let payload: DiditWebhookPayload
  try {
    payload = JSON.parse(rawBody) as DiditWebhookPayload
  } catch {
    console.error('[didit:webhook] unparseable JSON:', rawBody.slice(0, 500))
    return new Response('bad json', { status: 400 })
  }

  const sessionId = payload.session_id
  const status = payload.status
  if (!sessionId || !status) {
    // Signed, so genuinely from Didit — just not a session event we handle
    // (entity/transaction families share this envelope). Acknowledge it;
    // retrying would not help.
    return new Response('ignored', { status: 200 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    // Missing service-role key. 500 so Didit RETRIES (~1min, then ~4min) —
    // that buys time to add the env var and redeploy without losing the result.
    console.error('[didit:webhook] SUPABASE_SERVICE_ROLE_KEY is not configured')
    return new Response('server not configured', { status: 500 })
  }

  const { data: req, error: findErr } = await supabase
    .from('special_exam_requests')
    .select('id, student_id, didit_event_id, didit_checked_at, didit_status')
    .eq('didit_session_id', sessionId)
    .maybeSingle()

  if (findErr) {
    console.error('[didit:webhook] lookup failed', findErr)
    return new Response('lookup failed', { status: 500 })
  }
  if (!req) {
    // A session we have no request for — e.g. one started from Didit's console,
    // or a request deleted since. 200, not 404: 404 makes Didit retry twice for
    // something that will never resolve.
    console.warn('[didit:webhook] no request for session', sessionId)
    return new Response('no matching request', { status: 200 })
  }

  // ── Idempotency ────────────────────────────────────────────────────────────
  // Didit retries on 5xx/404 (~1min, then ~4min) and each attempt re-sends the
  // SAME event_id. Applying it twice is harmless in itself, but skipping keeps
  // the progress log from filling with duplicates.
  if (payload.event_id && payload.event_id === req.didit_event_id) {
    return new Response('duplicate', { status: 200 })
  }

  // ── Out-of-order guard ─────────────────────────────────────────────────────
  // Retries mean an older event can land AFTER a newer one — a re-delivered
  // "In Progress" arriving behind "Approved" would silently un-verify a parent.
  // Compare Didit's own dispatch time, not ours.
  const eventSeconds = payload.timestamp ?? payload.created_at ?? null
  const eventAt = eventSeconds ? new Date(eventSeconds * 1000) : new Date()
  if (req.didit_checked_at && eventAt < new Date(req.didit_checked_at)) {
    console.warn('[didit:webhook] stale event for', sessionId, '— ignored')
    return new Response('stale', { status: 200 })
  }

  const summary = summarizeDecision(payload.decision ?? null)

  const { error: updErr } = await supabase
    .from('special_exam_requests')
    .update({
      didit_status: status,
      didit_checked_at: eventAt.toISOString(),
      didit_event_id: payload.event_id ?? null,
      didit_liveness_score: summary.livenessScore,
      didit_face_match_score: summary.faceMatchScore,
      didit_document_type: summary.documentType,
      didit_id_name: summary.idName,
      didit_warnings: summary.warnings,
    })
    .eq('id', req.id)

  if (updErr) {
    // 500 so Didit retries rather than dropping the result on a transient blip.
    console.error('[didit:webhook] update failed', updErr)
    return new Response('update failed', { status: 500 })
  }

  // Audit trail, in the same spirit as the RA 10173 consent entry written at
  // submission. Only terminal statuses are logged — "In Progress" fires on every
  // step and would bury the timeline. A failure here must not fail the webhook:
  // the verification result is already saved, and Didit retrying would only
  // duplicate the log.
  if (isTerminal(status) && req.didit_status !== status) {
    const scores = [
      summary.livenessScore != null ? `liveness ${summary.livenessScore}` : null,
      summary.faceMatchScore != null ? `face match ${summary.faceMatchScore}` : null,
    ].filter(Boolean).join(', ')
    const { error: logErr } = await supabase.from('progress_logs').insert({
      request_id: req.id,
      // progress_logs.actor_id is NOT NULL and references profiles, so it cannot
      // record "Didit" as the actor. The student who owns the request is used,
      // and the action text names the real source.
      actor_id: req.student_id,
      actor_role: 'student',
      action: `Parent identity verification — ${statusLabel(status)}${scores ? ` (${scores})` : ''}`,
    })
    if (logErr) console.error('[didit:webhook] progress log failed', logErr)
  }

  // Everything above is one indexed lookup plus one indexed update — a few
  // milliseconds. Didit's guidance to "do heavy work asynchronously" would mean
  // Next's after(), which responds 200 first and works afterwards. That is the
  // wrong trade here: a failure after the 200 is invisible AND unretried, since
  // Didit only retries non-2xx. Doing the write inline means a transient failure
  // returns 500 and gets redelivered.
  return new Response('ok', { status: 200 })
}
