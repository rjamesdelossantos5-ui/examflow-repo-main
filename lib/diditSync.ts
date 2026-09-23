import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import { getSessionDecision, summarizeDecision, isTerminal, isInReview, declineSession } from '@/lib/didit'

type DB = Awaited<ReturnType<typeof createClient>>

/** The didit_* columns a sync writes, returned so a page can render the fresh
 *  values without re-querying the row it just updated. */
export interface DiditFields {
  didit_status: string
  didit_checked_at?: string
  didit_liveness_score: number | null
  didit_face_match_score: number | null
  didit_document_type: string | null
  didit_id_name: string | null
  didit_warnings: unknown
}

/**
 * Asks Didit for a session's current result and stores it on the request.
 *
 * This is the path that makes verification actually complete. The signed
 * webhook is meant to be primary, but it races the parent's browser: Didit
 * redirects the parent back and dispatches the webhook at the same moment, so
 * the page routinely renders before the webhook has been processed — and a page
 * rendered from a stale 'Not Started' shows the "Start parent verification"
 * button again. That was the verify-again loop. Syncing on render closes it,
 * and keeps working even if the webhook never arrives at all.
 *
 * Reads Didit's API server-side; never trusts the `?status=` the browser comes
 * back with, which Didit's own docs call an "untrusted UI hint".
 *
 * Writes through the caller's RLS-bound client, so a student can only ever sync
 * their own request (the .eq('student_id') filter is defence in depth over RLS).
 */
export async function syncDiditResult(
  supabase: DB,
  requestId: string,
  studentId: string,
  sessionId: string,
): Promise<{ fields: DiditFields | null; error: string | null }> {
  const got = await getSessionDecision(sessionId)
  if (got.error || !got.status) return { fields: null, error: got.error ?? 'Could not read the verification result.' }
  const { decision } = got
  let status = got.status

  // Never leave a session "In Review" — see declineSession in lib/didit.ts.
  // Stored as Declined only if Didit accepted the change, so our record never
  // disagrees with theirs. If it failed, "In Review" is stored as-is: the page
  // still shows it as not verified, and the next sync tries the decline again.
  if (isInReview(status)) {
    const d = await declineSession(sessionId, 'Inconclusive result — declined automatically by EXAMFLOW.')
    if (d.ok) status = 'Declined'
  }

  const summary = summarizeDecision(decision)
  const fields: DiditFields = {
    didit_status: status,
    didit_liveness_score: summary.livenessScore,
    didit_face_match_score: summary.faceMatchScore,
    didit_document_type: summary.documentType,
    didit_id_name: summary.idName,
    didit_warnings: summary.warnings,
  }

  // didit_checked_at is the webhook's out-of-order guard: an event older than it
  // is discarded as stale. Stamp it only on a FINAL result. Stamping an interim
  // 'In Progress' with our own clock could make Didit's genuine 'Approved'
  // webhook — timestamped by Didit's clock — look older than it is and get
  // thrown away. A final result, by contrast, should block anything older.
  if (isTerminal(status)) fields.didit_checked_at = new Date().toISOString()

  const { error: updErr } = await supabase
    .from('special_exam_requests')
    .update(fields)
    .eq('id', requestId)
    .eq('student_id', studentId)

  if (updErr) {
    console.error('[diditSync] update failed', updErr)
    return { fields: null, error: 'Could not save the verification result.' }
  }
  return { fields, error: null }
}
