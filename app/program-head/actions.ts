'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
  if (!canOverride) return { error: 'You are not authorized to override the approval chain. Ask an admin to grant access.' }

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
