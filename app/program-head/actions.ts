'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActivePeriod } from '@/lib/examSettings'

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

  if (error) return { error: error.message }
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
  if (error) return { error: error.message }

  revalidatePath('/program-head/overview')
  return { error: null }
}

export async function acceptRequest(requestId: string, scheduleStr: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  const finalSchedule = scheduleStr ? new Date(scheduleStr).toISOString() : null

  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'accepted', final_schedule: finalSchedule })
    .eq('id', requestId)
    .eq('status', 'approved_by_teacher')
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'This request was already handled by someone else.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: scheduleStr
      ? `Accepted by Program Head. Schedule: ${new Date(scheduleStr).toLocaleString()}`
      : 'Accepted by Program Head',
  })

  revalidatePath('/program-head')
  return { error: null }
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

  if (error) return { error: error.message }
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

  if (error) return { error: error.message }
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

  if (error) return { error: error.message }
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

  if (error) return { error: error.message }
  if (!deleted?.length) return { error: 'Only accepted or scheduled records can be deleted.' }

  revalidatePath('/program-head/students')
  revalidatePath('/program-head/overview')
  return { error: null }
}

export async function updateSubmissionWindow(days: number) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase } = ctx

  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return { error: 'Days must be between 1 and 365' }
  }

  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'submission_window_days', value: String(days), updated_at: new Date().toISOString() })

  if (error) return { error: error.message }
  revalidatePath('/program-head/settings')
  return { error: null }
}

interface PeriodInput {
  term: string
  submissionStart: string
  windowDays: number
}

// Create/update a term's SUBMISSION WINDOW (Prelim/Midterms/Pre-finals/Finals)
// and make it the single active one students submit to. The exam schedule
// (date/location/what-to-bring) is saved separately via saveExamSchedule, so
// this upsert deliberately does NOT touch those columns — one term = one row
// (school_year is fixed to '', giving one period per term).
export async function savePeriod(input: PeriodInput) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase } = ctx

  if (!['prelim', 'midterms', 'prefinals', 'finals'].includes(input.term)) return { error: 'Choose a term.' }
  if (!input.submissionStart) return { error: 'Set a submission start date.' }
  if (!Number.isInteger(input.windowDays) || input.windowDays < 1 || input.windowDays > 365) {
    return { error: 'Submission window must be 1–365 days.' }
  }

  const row = {
    term: input.term,
    school_year: '',
    submission_start: input.submissionStart,
    window_days: input.windowDays,
    is_active: true,
  }

  const { data: saved, error } = await supabase
    .from('exam_periods')
    .upsert(row, { onConflict: 'term,school_year' })
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Exactly one active period.
  await supabase.from('exam_periods').update({ is_active: false }).neq('id', saved!.id)

  revalidatePath('/program-head/settings')
  revalidatePath('/student')
  revalidatePath('/student/submit')
  return { error: null }
}

interface ScheduleInput {
  examStart: string // ISO or datetime-local
  examEnd: string // ISO or datetime-local ('' = single day)
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

  if (!input.examStart) return { error: 'Set the exam start date & time.' }
  const start = new Date(input.examStart)
  if (isNaN(start.getTime())) return { error: 'Invalid exam start date.' }
  const end = input.examEnd ? new Date(input.examEnd) : null
  if (end && isNaN(end.getTime())) return { error: 'Invalid exam end date.' }
  if (end && end.getTime() < start.getTime()) return { error: 'Exam end must be on or after the start.' }

  const { error } = await supabase
    .from('exam_periods')
    .update({
      exam_day: start.toISOString(),
      exam_end_day: end ? end.toISOString() : null,
      exam_location: String(input.examLocation ?? '').trim().slice(0, 300) || null,
      exam_bring: String(input.examBring ?? '').trim().slice(0, 1000) || null,
    })
    .eq('id', active.id)
  if (error) return { error: error.message }

  revalidatePath('/program-head/settings')
  revalidatePath('/student')
  return { error: null }
}

export async function setActivePeriod(id: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase } = ctx

  const { error } = await supabase.from('exam_periods').update({ is_active: true }).eq('id', id)
  if (error) return { error: error.message }
  await supabase.from('exam_periods').update({ is_active: false }).neq('id', id)

  revalidatePath('/program-head/settings')
  revalidatePath('/student')
  return { error: null }
}
