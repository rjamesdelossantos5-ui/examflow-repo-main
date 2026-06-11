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

  const { error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'approved_by_teacher' })
    .eq('id', requestId)
    .eq('status', 'verified_by_registrar')

  if (error) return { error: error.message }

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

  const { error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'rejected', rejection_reason: sanitizedReason, rejected_by_role: role })
    .eq('id', requestId)

  if (error) return { error: error.message }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: `Rejected by Subject Teacher: ${sanitizedReason}`,
  })

  revalidatePath('/teacher')
  return { error: null }
}
