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

  // Ensure the request is in THIS teacher's queue. RLS select scopes a teacher
  // to their own subjects, so a foreign request returns nothing — without this,
  // the permissive staff UPDATE policy would let a teacher approve another
  // teacher's request by id. (Admins can see all, so they're unaffected.)
  const { data: owned } = await supabase.from('special_exam_requests').select('id').eq('id', requestId).maybeSingle()
  if (!owned) return { error: 'This request is not in your queue.' }

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

// Approve every still-pending form for a student at once. RLS scopes the SELECT
// to this teacher's own subjects, so foreign ids are dropped before the update.
export async function approveAll(requestIds: string[]) {
  const ctx = await requireTeacher()
  if (!ctx) return { error: 'Unauthorized', count: 0 }
  const { supabase, userId, role } = ctx

  const ids = [...new Set(requestIds)].filter(Boolean)
  if (!ids.length) return { error: 'Nothing to approve.', count: 0 }

  // Ownership: RLS returns only forms for subjects this teacher owns.
  const { data: owned } = await supabase.from('special_exam_requests').select('id').in('id', ids)
  const ownedIds = (owned ?? []).map((o) => o.id)
  if (!ownedIds.length) return { error: 'These requests are not in your queue.', count: 0 }

  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'approved_by_teacher' })
    .in('id', ownedIds)
    .eq('status', 'verified_by_registrar')
    .select('id')

  if (error) return { error: error.message, count: 0 }
  const rows = updated ?? []
  if (!rows.length) return { error: 'These requests were already handled.', count: 0 }

  await supabase.from('progress_logs').insert(
    rows.map((r) => ({
      request_id: r.id,
      actor_id: userId,
      actor_role: role,
      action: 'Approved by Subject Teacher — forwarded to Program Head',
    }))
  )

  revalidatePath('/teacher')
  return { error: null, count: rows.length }
}

export async function rejectTeacherRequest(requestId: string, reason: string) {
  const ctx = await requireTeacher()
  if (!ctx) return { error: 'Unauthorized' }
  const { supabase, userId, role } = ctx

  const sanitizedReason = String(reason).trim().slice(0, 1000)
  if (!sanitizedReason) return { error: 'Rejection reason is required' }

  // Same ownership guard as approveRequest.
  const { data: owned } = await supabase.from('special_exam_requests').select('id').eq('id', requestId).maybeSingle()
  if (!owned) return { error: 'This request is not in your queue.' }

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
