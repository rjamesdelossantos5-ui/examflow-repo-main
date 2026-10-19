import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { isApproved, deleteSession } from '@/lib/didit'

type Admin = NonNullable<ReturnType<typeof createAdminClient>>

// A student can file up to MAX_GROUP subjects in one submission. Each subject is
// its own request (own teacher, own review) but they share ONE parent check:
// the requests carry the same verification_group, the check is started on the
// first one, and once it is Approved the result is copied to the others here.
export const MAX_GROUP = 7

/**
 * Copies an Approved parent verification from a request to the other requests
 * filed in the same submission. No-op for a single-subject request, for a result
 * that isn't Approved, and for siblings that already have their own approval.
 * Best effort: a failure is logged, and the next sync/webhook tries again.
 */
export async function shareVerificationWithGroup(admin: Admin, requestId: string) {
  const { data: src } = await admin
    .from('special_exam_requests')
    .select('id, student_id, verification_group, didit_session_id, didit_status, didit_checked_at, didit_event_id, didit_liveness_score, didit_face_match_score, didit_document_type, didit_id_name, didit_warnings')
    .eq('id', requestId)
    .maybeSingle()
  if (!src?.verification_group || !isApproved(src.didit_status as string | null)) return

  const { data: shared, error } = await admin
    .from('special_exam_requests')
    .update({
      didit_session_id: src.didit_session_id,
      didit_status: src.didit_status,
      didit_checked_at: src.didit_checked_at,
      didit_event_id: src.didit_event_id,
      didit_liveness_score: src.didit_liveness_score,
      didit_face_match_score: src.didit_face_match_score,
      didit_document_type: src.didit_document_type,
      didit_id_name: src.didit_id_name,
      didit_warnings: src.didit_warnings,
    })
    .eq('verification_group', src.verification_group)
    .eq('student_id', src.student_id)
    .neq('id', requestId)
    .is('student_confirmed_at', null)
    .neq('didit_status', 'Approved')
    .select('id')
  if (error) {
    console.error('[verificationGroup] share failed', error)
    return
  }
  if (shared?.length) {
    await admin.from('progress_logs').insert(
      shared.map((r) => ({
        request_id: r.id as string,
        actor_id: src.student_id as string,
        actor_role: 'student',
        action: 'Parent identity verification — Approved (one check shared by this submission)',
      })),
    )
  }
}

/**
 * A parent who already passed the face and ID check this term does not repeat it
 * for another request. Copies the student's most recent Approved check in the
 * same term onto the new requests. A check the Program Head returned has its
 * session cleared, so it never matches. Returns true when a check was reused.
 *
 * The photos behind the check stay at Didit until the term's requests are purged
 * (deleteOrphanedSessions), so the Program Head can still compare them.
 */
export async function reuseApprovedVerification(admin: Admin, studentId: string, periodId: string, targetIds: string[]): Promise<boolean> {
  if (!targetIds.length) return false
  const { data: src } = await admin
    .from('special_exam_requests')
    .select('didit_session_id, didit_status, didit_checked_at, didit_event_id, didit_liveness_score, didit_face_match_score, didit_document_type, didit_id_name, didit_warnings')
    .eq('student_id', studentId)
    .eq('period_id', periodId)
    .eq('didit_status', 'Approved')
    .not('didit_session_id', 'is', null)
    .not('id', 'in', `(${targetIds.join(',')})`)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!src) return false

  const { data: updated, error } = await admin
    .from('special_exam_requests')
    .update(src)
    .in('id', targetIds)
    .eq('student_id', studentId)
    .select('id')
  if (error || !updated?.length) {
    console.error('[verificationGroup] reuse failed', error)
    return false
  }
  await admin.from('progress_logs').insert(
    updated.map((r) => ({
      request_id: r.id as string,
      actor_id: studentId,
      actor_role: 'student',
      action: 'Parent identity verification — Approved earlier this term, reused for this request',
    })),
  )
  return true
}

/**
 * Deletes Didit's copy of the parent's photos for sessions that no request uses
 * any more. Called when finished requests are purged, which is when a term's
 * photos are due to go. A session still used by another request is kept.
 */
export async function deleteOrphanedSessions(
  supabase: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  sessionIds: (string | null | undefined)[],
) {
  const ids = [...new Set(sessionIds.filter((s): s is string => !!s))]
  await Promise.all(ids.map(async (id) => {
    const { data: stillUsed } = await supabase.from('special_exam_requests').select('id').eq('didit_session_id', id).limit(1)
    if (stillUsed?.length) return
    await deleteSession(id)
  }))
}
