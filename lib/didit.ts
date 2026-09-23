import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Didit identity verification — hosted flow.
 *
 * The parent scans their ID and takes a liveness-checked selfie on Didit's own
 * domain (verify.didit.me), NOT on EXAMFLOW. That matters for three reasons:
 *
 *   1. The camera is requested by Didit's origin, so our own
 *      `Permissions-Policy: camera=()` (next.config.ts) stays untouched.
 *   2. No Didit code runs in our page, so `script-src 'self'` and the missing
 *      `wasm-unsafe-eval` in production are irrelevant.
 *   3. Every call below is server-to-server, so `connect-src` never applies —
 *      CSP governs browsers, not Node.
 *
 * Nothing in this file may be imported from a Client Component: the `server-only`
 * import above turns that into a build error rather than leaking DIDIT_API_KEY.
 */

const API_BASE = 'https://verification.didit.me'
// Didit rate-limits at 600 req/min; we are nowhere near it. This timeout exists
// so a hung Didit request can't hold a Server Action open for the full function
// duration (300s on Vercel).
const TIMEOUT_MS = 15_000

/** Verbatim Didit session statuses. Case differs between their docs pages
 *  ("Kyc Expired" vs "KYC Expired"), so never match these with ===; use
 *  isApproved()/isTerminal() below, which normalise case. */
export type DiditStatus =
  | 'Not Started' | 'In Progress' | 'Awaiting User' | 'In Review'
  | 'Approved' | 'Declined' | 'Resubmitted' | 'Expired' | 'Kyc Expired' | 'Abandoned'

export interface DiditWarning {
  risk?: string
  short_description?: string
  long_description?: string
}

/** The decision object, as returned by both the webhook and GET /decision/.
 *  Per-feature results are PLURAL ARRAYS because one workflow can contain
 *  several instances of the same feature — never assume index 0 exists. */
export interface DiditDecision {
  id_verifications?: Array<{
    status?: string
    document_type?: string
    full_name?: string
    first_name?: string
    last_name?: string
    warnings?: DiditWarning[]
  }>
  liveness_checks?: Array<{ status?: string; method?: string; score?: number; warnings?: DiditWarning[] }>
  face_matches?: Array<{ status?: string; score?: number; warnings?: DiditWarning[] }>
}

export interface DiditSession {
  session_id: string
  url: string
  status: string
}

/** Reads the API key at call time, not module load, so a missing key surfaces as
 *  a handled error instead of crashing the whole route on import. */
function apiKey(): string | null {
  return process.env.DIDIT_API_KEY || null
}

export const DIDIT_NOT_CONFIGURED =
  'Identity verification is not configured on the server. Add DIDIT_API_KEY and DIDIT_WORKFLOW_ID to the environment variables, then redeploy.'

/**
 * Creates a verification session and returns the hosted URL to send the parent to.
 *
 * `vendorData` should be the request id: Didit treats it as an idempotency key —
 * if an UNFINISHED session already exists for the same vendor_data on the current
 * published workflow version, the existing session is returned instead of a new
 * one (still HTTP 201). So a parent who abandons and retries resumes rather than
 * burning a second check against the 500/month free tier.
 */
export async function createVerificationSession(opts: {
  vendorData: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}): Promise<{ session: DiditSession | null; error: string | null }> {
  const key = apiKey()
  const workflowId = process.env.DIDIT_WORKFLOW_ID
  if (!key || !workflowId) return { session: null, error: DIDIT_NOT_CONFIGURED }

  try {
    const res = await fetch(`${API_BASE}/v3/session/`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: opts.vendorData,
        callback: opts.callbackUrl,
        language: 'en',
        metadata: opts.metadata ?? {},
        // expected_details is deliberately NOT sent. It would let Didit validate
        // the name on the ID against an expected first/last name — which is
        // exactly how "an adult was present" becomes "the parent was present".
        // We have no guardian name on file to supply (profiles has no such
        // column), so there is nothing to validate against yet.
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!res.ok) {
      // 400 = validation error OR insufficient credits, 401 = bad key,
      // 403 = no permission, 429 = rate limited. The body often explains which.
      const body = await res.text().catch(() => '')
      console.error('[didit:createSession]', res.status, body.slice(0, 500))
      if (res.status === 401 || res.status === 403) return { session: null, error: DIDIT_NOT_CONFIGURED }
      return { session: null, error: 'Could not start identity verification. Please try again.' }
    }

    const session = (await res.json()) as DiditSession
    if (!session?.url || !session?.session_id) {
      console.error('[didit:createSession] malformed response', session)
      return { session: null, error: 'Could not start identity verification. Please try again.' }
    }
    return { session, error: null }
  } catch (err) {
    console.error('[didit:createSession]', err)
    return { session: null, error: 'Could not reach the verification service. Please try again.' }
  }
}

/**
 * Re-fetches a session's decision from Didit.
 *
 * This is the trustworthy source. The browser comes back from Didit with
 * `?status=...` in the query string, but Didit's own docs call those
 * "untrusted UI hints" — a student can retype the URL. Never write a status to
 * the database from the callback; only from a signed webhook or from here.
 */
export async function getSessionDecision(
  sessionId: string,
): Promise<{ status: string | null; decision: DiditDecision | null; error: string | null }> {
  const key = apiKey()
  if (!key) return { status: null, decision: null, error: DIDIT_NOT_CONFIGURED }

  try {
    const res = await fetch(`${API_BASE}/v3/session/${encodeURIComponent(sessionId)}/decision/`, {
      headers: { 'x-api-key': key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[didit:getDecision]', res.status, body.slice(0, 500))
      return { status: null, decision: null, error: 'Could not read the verification result.' }
    }
    // This endpoint returns id_verifications / liveness_checks / face_matches at
    // the ROOT of the response. Only the WEBHOOK wraps them in a `decision` key
    // (confirmed against Didit's own didit-verification-management skill). This
    // used to read json.decision alone, which is undefined here — so every
    // result fetched this way saved its status but silently dropped the scores,
    // document type and ID name. Accept either shape.
    const json = (await res.json()) as DiditDecision & { status?: string; decision?: DiditDecision }
    return { status: json.status ?? null, decision: json.decision ?? json, error: null }
  } catch (err) {
    console.error('[didit:getDecision]', err)
    return { status: null, decision: null, error: 'Could not reach the verification service.' }
  }
}

/**
 * Resolves a session Didit left "In Review" by declining it.
 *
 * In Review means Didit was not confident either way and parked the session
 * for a human to decide in Didit's console. Nobody at the school does that job,
 * so the student sat on "We're reviewing your submission" indefinitely.
 * EXAMFLOW acts as that reviewer and always decides "not verified": uncertain is
 * never good enough to vouch that a parent was present, and a declined parent
 * can simply try again with a clearer photo.
 *
 * PATCH /v3/session/{id}/update-status/ with new_status "Declined" — verified
 * against Didit's didit-verification-management skill.
 */
export async function declineSession(sessionId: string, comment: string): Promise<{ ok: boolean; error: string | null }> {
  const key = apiKey()
  if (!key) return { ok: false, error: DIDIT_NOT_CONFIGURED }

  try {
    const res = await fetch(`${API_BASE}/v3/session/${encodeURIComponent(sessionId)}/update-status/`, {
      method: 'PATCH',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_status: 'Declined', comment }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[didit:declineSession]', res.status, body.slice(0, 500))
      return { ok: false, error: 'Could not update the verification.' }
    }
    return { ok: true, error: null }
  } catch (err) {
    console.error('[didit:declineSession]', err)
    return { ok: false, error: 'Could not reach the verification service.' }
  }
}

/**
 * Verifies a webhook came from Didit.
 *
 * Uses X-Signature — HMAC-SHA256 over the EXACT RAW BYTES. Didit also sends
 * X-Signature-V2 (HMAC over sorted, Unicode-preserved canonical JSON) and
 * recommends it for stacks that re-encode the body before you see it. We
 * deliberately do not use V2: their published example calls `sortKeys()` and
 * `shortenFloats()` without ever defining them, so implementing it would mean
 * guessing at their canonicalisation. Next.js route handlers hand us the
 * untouched bytes via `await request.text()`, which makes X-Signature exact and
 * unambiguous.
 *
 * Fails closed: a missing header, a bad timestamp, or a length mismatch all
 * return false.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): { ok: boolean; reason?: string } {
  const secret = process.env.DIDIT_WEBHOOK_SECRET
  if (!secret) return { ok: false, reason: 'DIDIT_WEBHOOK_SECRET is not set' }
  if (!signatureHeader) return { ok: false, reason: 'missing X-Signature' }
  if (!timestampHeader) return { ok: false, reason: 'missing X-Timestamp' }

  // Replay window. Didit dispatches with a Unix-seconds timestamp and retries
  // at ~1min and ~4min after a failure, so 300s covers every legitimate retry.
  const ts = Number.parseInt(timestampHeader, 10)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'unparseable X-Timestamp' }
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return { ok: false, reason: 'stale timestamp' }

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signatureHeader, 'utf8')
  // timingSafeEqual throws on a length mismatch, so the length is checked first —
  // and the comparison itself stays constant-time to avoid leaking the signature
  // one byte at a time.
  if (a.length !== b.length) return { ok: false, reason: 'signature length mismatch' }
  if (!timingSafeEqual(a, b)) return { ok: false, reason: 'signature mismatch' }
  return { ok: true }
}

/** Case-insensitive, because Didit's docs disagree with themselves on casing
 *  ("Kyc Expired" in the session reference, "KYC Expired" in the webhook guide).
 *  Matching on exact strings would silently fall through on the real value. */
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export const isApproved = (status: string | null | undefined) => norm(status) === 'approved'
/** Didit's "In Review" — see declineSession for why EXAMFLOW never leaves one there. */
export const isInReview = (status: string | null | undefined) => norm(status) === 'in review'

/** True once Didit will send no further updates for this session. */
export function isTerminal(status: string | null | undefined): boolean {
  return ['approved', 'declined', 'expired', 'kyc expired', 'abandoned'].includes(norm(status))
}

/** Human-readable label for a status, for reviewers and students. */
export function statusLabel(status: string | null | undefined): string {
  switch (norm(status)) {
    case 'approved': return 'Verified'
    case 'declined': return 'Failed'
    case 'in review': return 'Under review'
    case 'in progress': return 'In progress'
    case 'awaiting user': return 'Waiting on parent'
    case 'resubmitted': return 'Resubmitted'
    case 'abandoned': return 'Not completed'
    case 'expired':
    case 'kyc expired': return 'Expired'
    case 'not started': return 'Not started'
    default: return status ? String(status) : 'Not started'
  }
}

/**
 * Flattens Didit's plural per-feature arrays into the handful of values we
 * actually store. Every field is optional in their schema, so everything here
 * is defensive — a workflow change on their side must not throw in our webhook.
 */
export function summarizeDecision(decision: DiditDecision | null) {
  const id = decision?.id_verifications?.[0]
  const liveness = decision?.liveness_checks?.[0]
  const face = decision?.face_matches?.[0]

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  // Warnings from every feature, tagged so a reviewer can tell which check
  // raised which — they all look alike once flattened.
  const warnings = [
    ...(id?.warnings ?? []).map((w) => ({ ...w, feature: 'id_verification' })),
    ...(liveness?.warnings ?? []).map((w) => ({ ...w, feature: 'liveness' })),
    ...(face?.warnings ?? []).map((w) => ({ ...w, feature: 'face_match' })),
  ]

  return {
    livenessScore: num(liveness?.score),
    faceMatchScore: num(face?.score),
    documentType: id?.document_type ?? null,
    // Prefer full_name; fall back to first+last. The `|| null` is inside the
    // parens on purpose — an empty join must become null, not ''.
    idName: id?.full_name ?? ([id?.first_name, id?.last_name].filter(Boolean).join(' ').trim() || null),
    warnings: warnings.length ? warnings : null,
  }
}
