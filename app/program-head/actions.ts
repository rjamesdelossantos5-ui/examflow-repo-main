'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActivePeriod, TERM_LABEL, SEMESTER_LABEL } from '@/lib/examSettings'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'
import { withRegistrarGate } from '@/lib/registrarGate'
import { deleteSession, getSessionDecision, photoUrl } from '@/lib/didit'
import { reviewableSession } from '@/lib/verificationReview'
import { VERIFICATION_PHOTOS, type VerificationPhoto } from '@/lib/verificationPhotos'
import { REVERIFY_LOG_PREFIX } from '@/lib/rejectReasons'

// Deletes Didit's copy of the parent's ID photos and selfie once the Program
// Head is done with them (see deleteSession in lib/didit.ts). Best-effort: a
// failure is logged there and never blocks the decision, which is already saved.
async function deleteVerificationPhotos(sessionIds: (string | null | undefined)[]) {
  const ids = [...new Set(sessionIds.filter((s): s is string => !!s))]
  await Promise.all(ids.map((id) => deleteSession(id)))
}

async function requirePH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role, can_override').eq('id', user.id).single()
  if (!p || !['program_head', 'admin'].includes(p.role)) return null
  return { supabase, userId: user.id, role: p.role, canOverride: p.role === 'admin' || !!p.can_override }
}

// Authorized program heads may accept a request even if the registrar or
// teacher hasn't acted yet (bypasses the earlier stages, with an audit log).
export async function overrideAccept(requestId: string, scheduleStr: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role, canOverride } = ctx

  // Authorized either by the admin-granted global flag, OR by an approved
  // per-request override for this specific request.
  let authorized = canOverride
  if (!authorized) {
    const { data: appr } = await supabase
      .from('override_requests')
      .select('id')
      .eq('request_id', requestId)
      .eq('requested_by', userId)
      .eq('status', 'approved')
      .limit(1)
    authorized = !!(appr && appr.length)
  }
  if (!authorized) return { error: 'You are not authorized to override. Request admin approval first.' }

  const finalSchedule = scheduleStr ? new Date(scheduleStr).toISOString() : null

  // Read the type first — same rule, and same reason, as acceptRequest. This
  // used to set 'accepted' unconditionally, so an EXCUSED request fast-tracked
  // here landed on the PAID path: the student was shown "Awaiting Receipt" for a
  // fee they do not owe, and the request was stranded for good, because excused
  // requests have no receipt step that could ever move them on to 'scheduled'.
  const { data: existing, error: readErr } = await supabase
    .from('special_exam_requests')
    .select('exam_type, didit_session_id')
    .eq('id', requestId)
    .maybeSingle()
  if (readErr || !existing) {
    return { error: friendlyError('overrideAccept:read', readErr, `We couldn’t read this request, so it was not accepted. ${RETRY_HINT}`) }
  }
  const isExcused = existing.exam_type === 'excused'
  const nextStatus = isExcused ? 'scheduled' : 'accepted'

  // Only override while it's still in an early stage; .select() confirms a row
  // actually changed so we don't log an override that didn't happen.
  //
  // The Registrar gate applies here too. An override exists for STAFF being
  // unavailable — the reasons offered are "absent" and "on leave" — not for
  // skipping the parent. Without the gate, 'submitted' matched forms whose
  // parent was never verified and which the student never submitted, so a
  // fast-track could accept a request that bypassed verification entirely.
  const { data: updated, error } = await withRegistrarGate((gate) => {
    let q = supabase
      .from('special_exam_requests')
      .update({ status: nextStatus, final_schedule: finalSchedule })
      .eq('id', requestId)
      .in('status', ['submitted', 'verified_by_registrar', 'approved_by_teacher'])
    if (gate) q = q.or(gate)
    return q.select('id')
  })

  if (error) return { error: friendlyError('overrideAccept', error, `We couldn't accept this request. ${RETRY_HINT}`) }
  if (!updated?.length) return { error: 'This request can’t be overridden — it is already accepted, scheduled or rejected, or the parent has not been verified and the student has not submitted it yet.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: `${isExcused ? 'Accepted & scheduled' : 'Accepted'} by Program Head (override — earlier stages bypassed)${scheduleStr ? `. Schedule: ${new Date(scheduleStr).toLocaleString()}` : ''}`,
  })

  await deleteVerificationPhotos([existing.didit_session_id])

  revalidatePath('/program-head')
  revalidatePath('/program-head/overview')
  return { error: null }
}

// PH asks the admin for permission to fast-track a stuck request.
export async function requestOverride(requestId: string, reasonType: string, reasonNote: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId } = ctx

  if (!['absent', 'on_leave', 'other'].includes(reasonType)) return { error: 'Please choose a reason.' }
  const note = reasonType === 'other' ? String(reasonNote ?? '').trim().slice(0, 500) : null
  if (reasonType === 'other' && !note) return { error: 'Please describe the reason.' }

  // Don't stack duplicate pending requests for the same form.
  const { data: existing } = await supabase
    .from('override_requests')
    .select('id')
    .eq('request_id', requestId)
    .eq('requested_by', userId)
    .eq('status', 'pending')
    .limit(1)
  if (existing && existing.length) return { error: 'You already have a pending request for this form.' }

  const { error } = await supabase
    .from('override_requests')
    .insert({ request_id: requestId, requested_by: userId, reason_type: reasonType, reason_note: note })
  if (error) return { error: friendlyError('requestOverride', error, `We couldn't send your override request. ${RETRY_HINT}`) }

  revalidatePath('/program-head/overview')
  return { error: null }
}

export async function acceptRequest(requestId: string, scheduleStr: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  const finalSchedule = scheduleStr ? new Date(scheduleStr).toISOString() : null

  // Excused requests have no receipt step, so accepting one finishes it —
  // it goes straight to 'scheduled'. Paid requests go to 'accepted' and then
  // wait for the student's cashier receipt.
  const { data: existing, error: readErr } = await supabase
    .from('special_exam_requests')
    .select('exam_type, didit_session_id')
    .eq('id', requestId)
    .maybeSingle()

  // Stop rather than guess. This used to read `existing?.exam_type === 'excused'`,
  // so ANY failure to read the row — an error, RLS hiding it, a deleted request —
  // silently evaluated to false and pushed the request down the PAID path: status
  // 'accepted' instead of 'scheduled', landing an excused exam in the Registrar's
  // Payment Assessment tab and billing the student for a fee they do not owe.
  // The fee path must never be the fallback for "we could not tell".
  if (readErr || !existing) {
    return { error: friendlyError('acceptRequest:read', readErr, `We couldn’t read this request, so it was not accepted. ${RETRY_HINT}`) }
  }
  const isExcused = existing.exam_type === 'excused'
  const nextStatus = isExcused ? 'scheduled' : 'accepted'

  // Gated like the First Approval queue: a request returned for re-verification
  // stays 'approved_by_teacher' while the parent verifies again, and must not
  // be accepted from a panel that was open before it was returned.
  const { data: updated, error } = await withRegistrarGate((gate) => {
    let q = supabase
      .from('special_exam_requests')
      .update({ status: nextStatus, final_schedule: finalSchedule })
      .eq('id', requestId)
      .eq('status', 'approved_by_teacher')
    if (gate) q = q.or(gate)
    return q.select('id')
  })

  if (error) return { error: friendlyError('acceptRequest', error, `We couldn't accept this request. ${RETRY_HINT}`) }
  if (!updated?.length) return { error: 'This request was already handled, or is waiting for the parent to verify again.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: isExcused
      ? 'Accepted & scheduled by Program Head (excused — no receipt needed)'
      : 'Accepted by Program Head — awaiting payment receipt',
  })

  // The manual ID and selfie check is done — first approval is their only use.
  await deleteVerificationPhotos([existing.didit_session_id])

  revalidatePath('/program-head')
  revalidatePath('/program-head/students')
  return { error: null }
}

// Accept every first-approval form for a student at once. Excused forms finish
// (scheduled); paid forms wait for the receipt (accepted). Only rows still at
// 'approved_by_teacher' are touched.
export async function acceptAll(requestIds: string[]) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized', count: 0 }
  const { supabase, userId, role } = ctx

  const ids = [...new Set(requestIds)].filter(Boolean)
  if (!ids.length) return { error: 'Nothing to accept.', count: 0 }

  // Gated like the First Approval queue — see acceptRequest.
  const { data: forms } = await withRegistrarGate((gate) => {
    let q = supabase
      .from('special_exam_requests')
      .select('id, exam_type, didit_session_id')
      .in('id', ids)
      .eq('status', 'approved_by_teacher')
    if (gate) q = q.or(gate)
    return q
  })
  const rows = (forms ?? []) as { id: string; exam_type: string; didit_session_id: string | null }[]
  if (!rows.length) return { error: 'These requests were already handled.', count: 0 }

  const excusedIds = rows.filter((r) => r.exam_type === 'excused').map((r) => r.id)
  const paidIds = rows.filter((r) => r.exam_type !== 'excused').map((r) => r.id)

  // .select('id') so the log lines and photo deletions below cover only the
  // rows that actually changed — never a form someone else handled meanwhile.
  const changed = new Set<string>()
  if (excusedIds.length) {
    const { data } = await supabase.from('special_exam_requests').update({ status: 'scheduled' }).in('id', excusedIds).eq('status', 'approved_by_teacher').select('id')
    for (const r of data ?? []) changed.add(r.id as string)
  }
  if (paidIds.length) {
    const { data } = await supabase.from('special_exam_requests').update({ status: 'accepted' }).in('id', paidIds).eq('status', 'approved_by_teacher').select('id')
    for (const r of data ?? []) changed.add(r.id as string)
  }
  const accepted = rows.filter((r) => changed.has(r.id))
  if (!accepted.length) return { error: 'These requests were already handled.', count: 0 }

  await supabase.from('progress_logs').insert(
    accepted.map((r) => ({
      request_id: r.id,
      actor_id: userId,
      actor_role: role,
      action: r.exam_type === 'excused'
        ? 'Accepted & scheduled by Program Head (excused — no receipt needed)'
        : 'Accepted by Program Head — awaiting payment receipt',
    }))
  )

  await deleteVerificationPhotos(accepted.map((r) => r.didit_session_id))

  revalidatePath('/program-head')
  revalidatePath('/program-head/students')
  return { error: null, count: accepted.length }
}

/**
 * The Program Head returns a request because of the parent's ID or selfie —
 * the face does not match, or it is not the student's parent or guardian.
 *
 * Not a rejection: the request stays at first approval ('approved_by_teacher')
 * and only the verification is cleared. The student sees the reason, their
 * parent verifies again, the student presses Submit, and it comes straight back
 * to this queue — never to the Registrar or the Teacher, who already approved
 * it. Until then the First Approval gate (lib/registrarGate.ts) keeps it out of
 * the queue, the badge and the bell.
 *
 * "Edit & Resubmit" cannot do this: it refuses a form with nothing changed, and
 * it keeps the old "Verified", so the parent would never be asked again.
 *
 * The rejected verification's photos are deleted at Didit straight away (the
 * user's decision, 2026-09-25) — the school keeps no copy of a failed one.
 */
export async function returnForReverification(requestId: string, reason: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  const sanitizedReason = String(reason).trim().slice(0, 1000)
  if (!sanitizedReason) return { error: 'A reason is required' }

  const { data: existing, error: readErr } = await supabase
    .from('special_exam_requests')
    .select('didit_session_id')
    .eq('id', requestId)
    .eq('status', 'approved_by_teacher')
    .maybeSingle()
  if (readErr) return { error: friendlyError('returnForReverification:read', readErr, `We couldn't read this request. ${RETRY_HINT}`) }
  if (!existing) return { error: 'This request was already handled by someone else.' }

  // The Program Head's own client may write these columns: the guard in
  // migration_protect_verification_columns.sql applies to students only.
  // 'Not Started' (not NULL) keeps it a verified-era request: NULL would read
  // as a legacy row and walk straight through the gate.
  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({
      didit_session_id: null,
      didit_status: 'Not Started',
      didit_checked_at: null,
      didit_event_id: null,
      didit_liveness_score: null,
      didit_face_match_score: null,
      didit_document_type: null,
      didit_id_name: null,
      didit_warnings: null,
      student_confirmed_at: null,
    })
    .eq('id', requestId)
    .eq('status', 'approved_by_teacher')
    .select('id')

  if (error) return { error: friendlyError('returnForReverification', error, `We couldn't return this request. ${RETRY_HINT}`) }
  if (!updated?.length) return { error: 'This request was already handled by someone else.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: `${REVERIFY_LOG_PREFIX}${sanitizedReason}`,
  })

  await deleteVerificationPhotos([existing.didit_session_id])

  revalidatePath('/program-head')
  return { error: null }
}

/**
 * Which of the parent's verification photos exist for this request, so the
 * panel shows only real ones (a passport has no back). The images themselves
 * load through app/program-head/verification-photo/route.ts, one per photo.
 */
export async function getVerificationPhotos(requestId: string): Promise<{ photos: VerificationPhoto[]; error: string | null }> {
  const access = await reviewableSession(requestId)
  if (!access.ok) {
    return { photos: [], error: access.reason === 'unauthorized' ? 'Unauthorized' : 'This request is no longer waiting for first approval.' }
  }
  if (!access.sessionId) return { photos: [], error: null }

  const got = await getSessionDecision(access.sessionId)
  if (got.error) {
    return { photos: [], error: 'We couldn’t load the photos from Didit. If this keeps happening they may no longer exist there — return the request so the parent verifies again.' }
  }
  return { photos: VERIFICATION_PHOTOS.filter((p) => photoUrl(got.decision, p)), error: null }
}

export async function rejectPHRequest(requestId: string, reason: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  const sanitizedReason = String(reason).trim().slice(0, 1000)
  if (!sanitizedReason) return { error: 'Rejection reason is required' }

  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'rejected', rejection_reason: sanitizedReason, rejected_by_role: role })
    .eq('id', requestId)
    .select('id')

  if (error) return { error: friendlyError('rejectPHRequest', error, `We couldn't save this rejection. ${RETRY_HINT}`) }
  if (!updated?.length) return { error: 'Request not found or no longer editable.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: `Rejected by Program Head: ${sanitizedReason}`,
  })

  revalidatePath('/program-head')
  return { error: null }
}

export async function confirmReceipt(requestId: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'scheduled' })
    .eq('id', requestId)
    .eq('status', 'receipt_uploaded')
    .select('id')

  if (error) return { error: friendlyError('confirmReceipt', error, `We couldn't confirm this receipt. ${RETRY_HINT}`) }
  if (!updated?.length) return { error: 'No receipt is awaiting confirmation for this request.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: 'Payment receipt verified by Program Head — Scheduled',
  })

  revalidatePath('/program-head')
  revalidatePath('/program-head/students')
  return { error: null }
}

export async function rejectReceipt(requestId: string, reason: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  const sanitizedReason = String(reason).trim().slice(0, 1000)
  if (!sanitizedReason) return { error: 'Rejection reason is required' }

  // Move back to accepted so student re-uploads
  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'accepted', rejection_reason: sanitizedReason })
    .eq('id', requestId)
    .eq('status', 'receipt_uploaded')
    .select('id')

  if (error) return { error: friendlyError('rejectReceipt', error, `We couldn't save this receipt rejection. ${RETRY_HINT}`) }
  if (!updated?.length) return { error: 'No receipt is awaiting review for this request.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: `Receipt rejected by Program Head: ${sanitizedReason}. Student asked to re-upload.`,
  })

  revalidatePath('/program-head')
  return { error: null }
}

// Delete a finished request (scheduled, or accepted excused) to clear the list
// after the exam. Requires the requests_ph_admin_delete RLS policy (see
// supabase/migration_delete.sql). Cascades media + logs; best-effort file cleanup.
export async function deleteFinishedRequest(requestId: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase } = ctx

  const { data: media } = await supabase
    .from('application_media')
    .select('storage_path')
    .eq('request_id', requestId)
  const paths = (media ?? []).map((m) => m.storage_path).filter(Boolean)
  if (paths.length) await supabase.storage.from('exam-documents').remove(paths)

  const { data: deleted, error } = await supabase
    .from('special_exam_requests')
    .delete()
    .eq('id', requestId)
    .in('status', ['accepted', 'scheduled'])
    .select('id')

  if (error) return { error: friendlyError('deleteFinishedRequest', error, `We couldn't delete this record. ${RETRY_HINT}`) }
  if (!deleted?.length) return { error: 'Only accepted or scheduled records can be deleted.' }

  revalidatePath('/program-head/students')
  revalidatePath('/program-head/overview')
  return { error: null }
}

interface PeriodInput {
  term: string
  semester: string
  /** '' or undefined = make this the current term WITHOUT opening a window.
   *  Stored as null, which computeWindow reports as configured:false, which
   *  every submission gate treats as closed. */
  submissionStart: string
  windowDays: number
}

// Create/update a term's SUBMISSION WINDOW (Prelim/Midterms/Pre-finals/Finals)
// for a semester (1st/2nd) and make it the single active one students submit
// to. The exam schedule (date/location/what-to-bring) is saved separately via
// saveExamSchedule, so this upsert deliberately does NOT touch those columns —
// one (term, semester) = one row (school_year is fixed to '' for now).
export async function savePeriod(input: PeriodInput) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase } = ctx

  if (!['prelim', 'midterms', 'prefinals', 'finals'].includes(input.term)) return { error: 'Choose a term.' }
  if (!['1st', '2nd'].includes(input.semester)) return { error: 'Choose a semester.' }
  // A blank date is allowed on purpose: it makes this the current term while
  // leaving submissions closed, so the PH can move off a finished term before
  // the next one's dates are announced instead of inventing one. See
  // supabase/migration_optional_window.sql.
  const start = input.submissionStart?.trim() || null
  if (!Number.isInteger(input.windowDays) || input.windowDays < 1 || input.windowDays > 365) {
    return { error: 'Submission window must be 1–365 days.' }
  }

  const row = {
    term: input.term,
    semester: input.semester,
    school_year: '',
    submission_start: start,
    window_days: input.windowDays,
    is_active: true,
  }

  let { data: saved, error } = await supabase
    .from('exam_periods')
    .upsert(row, { onConflict: 'term,school_year,semester' })
    .select('id')
    .single()

  // migration_semester.sql not applied yet (no `semester` column / index) —
  // fall back to the pre-semester shape so the PH can still save the window.
  if (error) {
    const { semester: _omit, ...legacy } = row
    ;({ data: saved, error } = await supabase
      .from('exam_periods')
      .upsert(legacy, { onConflict: 'term,school_year' })
      .select('id')
      .single())
  }
  // migration_optional_window.sql not applied yet — submission_start is still
  // NOT NULL, so a term-only save was rejected by the database. Say exactly
  // that instead of a generic failure; the PH can still save with a date.
  if (error && start === null) {
    return { error: 'Saving a term without a submission date needs supabase/migration_optional_window.sql to be run first. For now, set a start date as well.' }
  }
  if (error) return { error: friendlyError('savePeriod', error, `We couldn't save the submission window. ${RETRY_HINT}`) }

  // Exactly one active period.
  await supabase.from('exam_periods').update({ is_active: false }).neq('id', saved!.id)

  revalidatePath('/program-head/settings')
  revalidatePath('/student')
  revalidatePath('/student/submit')
  return { error: null }
}

interface ScheduleInput {
  examStart: string // ISO, date-only (midnight local)
  examEnd: string // ISO, date-only ('' = single day)
  examLocation: string
  examBring: string
}

// Save the ONE special-exam schedule for the active period. There is only ever
// one schedule per term; calling this again overwrites the previous one (the UI
// confirms before doing so). Students see the new schedule immediately.
export async function saveExamSchedule(input: ScheduleInput) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase } = ctx

  const active = await getActivePeriod(supabase)
  if (!active) return { error: 'Set and activate a submission window first, then schedule the exam.' }

  if (!input.examStart) return { error: 'Set the exam date.' }
  const start = new Date(input.examStart)
  if (isNaN(start.getTime())) return { error: 'Invalid exam start date.' }
  // Reject a date that has already passed. The client blocks anything before
  // today; here we allow a 1-day slack so a legitimate "today" isn't rejected
  // just because the server (UTC) and the school (UTC+8) disagree on the date.
  if (start.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return { error: 'The exam date can’t be in the past.' }
  }
  const end = input.examEnd ? new Date(input.examEnd) : null
  if (end && isNaN(end.getTime())) return { error: 'Invalid exam end date.' }
  if (end && end.getTime() < start.getTime()) return { error: 'Exam end must be on or after the start.' }

  const base = {
    exam_day: start.toISOString(),
    exam_end_day: end ? end.toISOString() : null,
    exam_location: String(input.examLocation ?? '').trim().slice(0, 300) || null,
    exam_bring: String(input.examBring ?? '').trim().slice(0, 1000) || null,
  }

  let { error } = await supabase.from('exam_periods').update({ ...base, schedule_updated_at: new Date().toISOString() }).eq('id', active.id)
  if (error) {
    // schedule_updated_at may not exist yet (migration_schedule_notify.sql not
    // run) — retry without it so the actual schedule still saves. The bell
    // notification / one-time popup for it just won't fire until that
    // migration is applied, but the PH isn't blocked from setting the date.
    ;({ error } = await supabase.from('exam_periods').update(base).eq('id', active.id))
  }
  if (error) return { error: friendlyError('saveExamSchedule', error, `We couldn't save the exam schedule. ${RETRY_HINT}`) }

  revalidatePath('/program-head/settings')
  revalidatePath('/student')
  return { error: null }
}

export async function setActivePeriod(id: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase } = ctx

  const { error } = await supabase.from('exam_periods').update({ is_active: true }).eq('id', id)
  if (error) return { error: friendlyError('setActivePeriod', error, `We couldn't switch the active term. ${RETRY_HINT}`) }
  await supabase.from('exam_periods').update({ is_active: false }).neq('id', id)

  revalidatePath('/program-head/settings')
  revalidatePath('/student')
  return { error: null }
}

// Removes a term that's no longer needed (e.g. one set up during testing).
// Blocked for the active term (switch active first) and for any term real
// requests are already tied to (special_exam_requests.period_id references it
// with no cascade/set-null, so deleting it would either error or silently
// orphan those requests into "legacy" — neither is safe to do quietly).
export async function deletePeriod(id: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase } = ctx

  const { data: period } = await supabase.from('exam_periods').select('is_active').eq('id', id).single()
  if (!period) return { error: 'Term not found.' }
  if (period.is_active) return { error: 'Set another term active before deleting this one.' }

  const { count } = await supabase
    .from('special_exam_requests')
    .select('id', { count: 'exact', head: true })
    .eq('period_id', id)
  if (count) return { error: `Can't delete — ${count} request${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} already tied to this term.` }

  const { error } = await supabase.from('exam_periods').delete().eq('id', id)
  if (error) return { error: friendlyError('deletePeriod', error, `We couldn't delete this term. ${RETRY_HINT}`) }

  revalidatePath('/program-head/settings')
  return { error: null }
}
