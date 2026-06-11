'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requirePH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!p || !['program_head', 'admin'].includes(p.role)) return null
  return { supabase, userId: user.id, role: p.role }
}

export async function acceptRequest(requestId: string, scheduleStr: string) {
  const ctx = await requirePH()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  const finalSchedule = scheduleStr ? new Date(scheduleStr).toISOString() : null

  const { error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'accepted', final_schedule: finalSchedule })
    .eq('id', requestId)
    .eq('status', 'approved_by_teacher')

  if (error) return { error: error.message }

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

  const { error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'rejected', rejection_reason: sanitizedReason, rejected_by_role: role })
    .eq('id', requestId)

  if (error) return { error: error.message }

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

  const { error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'scheduled' })
    .eq('id', requestId)
    .eq('status', 'receipt_uploaded')

  if (error) return { error: error.message }

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
  const { error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'accepted', rejection_reason: sanitizedReason })
    .eq('id', requestId)
    .eq('status', 'receipt_uploaded')

  if (error) return { error: error.message }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: `Receipt rejected by Program Head: ${sanitizedReason}. Student asked to re-upload.`,
  })

  revalidatePath('/program-head')
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
