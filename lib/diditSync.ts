import 'server-only'
import { createAdminClient, SERVICE_KEY_MISSING } from '@/lib/supabase/admin'
import {
  getSessionDecision, summarizeDecision, isTerminal, isInReview, isApproved, declineSession,
  isStudentsOwnId, OWN_ID_WARNING,
} from '@/lib/didit'


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
 * WRITES WITH THE SERVICE-ROLE CLIENT, and that is load-bearing. Students may
 * only update their own request while it is 'accepted' or 'rejected'
 * (supabase/migration_student_update_scope.sql) — deliberately, so the public
 * API can't be used to push a request forward. Verification happens while the
 * request is 'submitted', so through the student's own client every one of
 * these writes was silently discarded: no error, zero rows changed. That was
 * the real cause of the verify-again loop.
 *
 * CALLER CONTRACT: only call this after reading the row with the student's own
 * RLS-bound client, filtered by their user id — that read is the ownership
 * check. The write below repeats the student_id filter, and writes only the
 * didit_* columns this function chooses; nothing the student sends reaches it.
 */
export async function syncDiditResult(
  requestId: string,
  studentId: string,
  sessionId: string,
): Promise<{ fields: DiditFields | null; error: string | null }> {
  const got = await getSessionDecision(sessionId)
  if (got.error || !got.status) {
    // A failed read does not always mean there is no answer. The session is
    // deleted at Didit once the Program Head accepts or returns the request
    // (deleteSession in lib/didit.ts), and the webhook may have saved the final
    // result a moment after this page read the row. Either way the answer is
    // in our own row — return it, or the page offers verification again and a
    // new session overwrites a parent who already passed.
    const stored = await storedFinalResult(requestId, studentId, sessionId)
    if (stored) return { fields: stored, error: null }
    return { fields: null, error: got.error ?? 'Could not read the verification result.' }
  }
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

  // The student verifying with their own ID — see isStudentsOwnId in
  // lib/didit.ts. Declined on our side only: Didit's answer (a real ID, a
  // matching face) is right; it is EXAMFLOW's rule that refuses it.
  if (isApproved(status)) {
    const ownId = await presentedOwnId(requestId, summary.idName)
    if (ownId === null) return { fields: null, error: 'Could not save the verification result.' }
    if (ownId) {
      status = 'Declined'
      summary.warnings = [OWN_ID_WARNING]
    }
  }

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

  const admin = createAdminClient()
  if (!admin) return { fields: null, error: SERVICE_KEY_MISSING }

  const { data: saved, error: updErr } = await admin
    .from('special_exam_requests')
    .update(fields)
    .eq('id', requestId)
    .eq('student_id', studentId)
    .select('id')

  if (updErr) {
    console.error('[diditSync] update failed', updErr)
    return { fields: null, error: 'Could not save the verification result.' }
  }
  // An update that matches nothing is not an error to PostgREST — it returns
  // success with zero rows. Treat it as the failure it is, never as "saved".
  if (!saved?.length) {
    console.error('[diditSync] update matched no row', requestId)
    return { fields: null, error: 'Could not save the verification result.' }
  }

  // Didit's copy of the photos is kept on purpose — the Program Head compares
  // them by hand at first approval. See the webhook route for when they go.
  return { fields, error: null }
}

/** The final result already saved for this session, if there is one. */
async function storedFinalResult(requestId: string, studentId: string, sessionId: string): Promise<DiditFields | null> {
  const admin = createAdminClient()
  if (!admin) return null
  const { data } = await admin
    .from('special_exam_requests')
    .select('didit_status, didit_checked_at, didit_liveness_score, didit_face_match_score, didit_document_type, didit_id_name, didit_warnings')
    .eq('id', requestId)
    .eq('student_id', studentId)
    .eq('didit_session_id', sessionId)
    .maybeSingle()
  return data && isTerminal(data.didit_status as string | null) ? (data as unknown as DiditFields) : null
}

/**
 * Whether the ID Didit read is the student's own (isStudentsOwnId in
 * lib/didit.ts), against both the account name and the name on the request.
 * Null when the names could not be read: the caller must then store nothing
 * rather than an Approved that was never checked.
 *
 * Service-role read — only call it for a request already tied to the caller:
 * the webhook's session-id lookup, or syncDiditResult's caller contract.
 */
export async function presentedOwnId(requestId: string, idName: string | null): Promise<boolean | null> {
  if (!idName) return false
  const admin = createAdminClient()
  if (!admin) return null
  const { data, error } = await admin
    .from('special_exam_requests')
    .select('snap_name, student:profiles!student_id(full_name)')
    .eq('id', requestId)
    .maybeSingle()
  if (error || !data) {
    console.error('[diditSync] could not read the student names', error)
    return null
  }
  const student = data.student as unknown as { full_name: string } | null
  return isStudentsOwnId(idName, [data.snap_name as string | null, student?.full_name])
}
