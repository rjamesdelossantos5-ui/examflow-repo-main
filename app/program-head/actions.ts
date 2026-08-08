'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActivePeriod } from '@/lib/examSettings'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'

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

  // Only override while it's still in an early stage; .select() confirms a row
  // actually changed so we don't log an override that didn't happen.
  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'accepted', final_schedule: finalSchedule })
    .eq('id', requestId)
    .in('status', ['submitted', 'verified_by_registrar', 'approved_by_teacher'])
    .select('id')

  if (error) return { error: friendlyError('overrideAccept', error, `We couldn't accept this request. ${RETRY_HINT}`) }
  if (!updated?.length) return { error: 'This request can no longer be overridden (already accepted, scheduled, or rejected).' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: scheduleStr
      ? `Accepted by Program Head (override — earlier stages bypassed). Schedule: ${new Date(scheduleStr).toLocaleString()}`
      : 'Accepted by Program Head (override — earlier stages bypassed)',
  })

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
  const { data: existing } = await supabase
    .from('special_exam_requests')
    .select('exam_type')
    .eq('id', requestId)
    .maybeSingle()
  const isExcused = existing?.exam_type === 'excused'
  const nextStatus = isExcused ? 'scheduled' : 'accepted'

  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: nextStatus, final_schedule: finalSchedule })
    .eq('id', requestId)
    .eq('status', 'approved_by_teacher')
    .select('id')

  if (error) return { error: friendlyError('acceptRequest', error, `We couldn't accept this request. ${RETRY_HINT}`) }
  if (!updated?.length) return { error: 'This request was already handled by someone else.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: isExcused
      ? 'Accepted & scheduled by Program Head (excused — no receipt needed)'
      : 'Accepted by Program Head — awaiting payment receipt',
  })

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

  const { data: forms } = await supabase
    .from('special_exam_requests')
    .select('id, exam_type')
    .in('id', ids)
    .eq('status', 'approved_by_teacher')
  const rows = (forms ?? []) as { id: string; exam_type: string }[]
  if (!rows.length) return { error: 'These requests were already handled.', count: 0 }

  const excusedIds = rows.filter((r) => r.exam_type === 'excused').map((r) => r.id)
  const paidIds = rows.filter((r) => r.exam_type !== 'excused').map((r) => r.id)

  if (excusedIds.length) {
    await supabase.from('special_exam_requests').update({ status: 'scheduled' }).in('id', excusedIds).eq('status', 'approved_by_teacher')
  }
  if (paidIds.length) {
    await supabase.from('special_exam_requests').update({ status: 'accepted' }).in('id', paidIds).eq('status', 'approved_by_teacher')
  }

  await supabase.from('progress_logs').insert(
    rows.map((r) => ({
      request_id: r.id,
      actor_id: userId,
      actor_role: role,
      action: r.exam_type === 'excused'
        ? 'Accepted & scheduled by Program Head (excused — no receipt needed)'
        : 'Accepted by Program Head — awaiting payment receipt',
    }))
  )

  revalidatePath('/program-head')
  revalidatePath('/program-head/students')
  return { error: null, count: rows.length }
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
  if (!input.submissionStart) return { error: 'Set a submission start date.' }
  if (!Number.isInteger(input.windowDays) || input.windowDays < 1 || input.windowDays > 365) {
    return { error: 'Submission window must be 1–365 days.' }
  }

  const row = {
    term: input.term,
    semester: input.semester,
    school_year: '',
    submission_start: input.submissionStart,
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
