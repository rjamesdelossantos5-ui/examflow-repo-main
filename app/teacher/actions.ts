'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireTeacher() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!p || !['subject_teacher', 'admin'].includes(p.role)) return null
  return { supabase, userId: user.id, role: p.role }
}

export async function approveRequest(requestId: string) {
  const ctx = await requireTeacher()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  // Status guard doubles as concurrency control — if it's no longer awaiting
  // the teacher, 0 rows update and we skip the phantom log / false success.
  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'approved_by_teacher' })
    .eq('id', requestId)
    .eq('status', 'verified_by_registrar')
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'This request was already handled by someone else.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: 'Approved by Subject Teacher — forwarded to Program Head',
  })

  revalidatePath('/teacher')
  return { error: null }
}

export async function rejectTeacherRequest(requestId: string, reason: string) {
  const ctx = await requireTeacher()
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
    action: `Rejected by Subject Teacher: ${sanitizedReason}`,
  })

  revalidatePath('/teacher')
  return { error: null }
}
