'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notifyRequestVerified, notifyTeacherVerifiedMany } from '@/lib/email'

async function requireRegistrar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!p || !['registrar', 'admin'].includes(p.role)) return null
  return { supabase, userId: user.id, role: p.role }
}

export async function verifyRequest(requestId: string) {
  const ctx = await requireRegistrar()
  if (!ctx) return { error: 'Unauthorized' }

  const { supabase, userId, role } = ctx

  // The .eq('status', 'submitted') is an optimistic-concurrency guard: if the
  // request already moved on (double-click, or another reviewer acted first),
  // 0 rows match. .select() lets us detect that and avoid logging a phantom
  // "Verified" entry / showing a false success to the reviewer.
  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'verified_by_registrar' })
    .eq('id', requestId)
    .eq('status', 'submitted')
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'This request was already handled by someone else.' }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: userId,
    actor_role: role,
    action: 'Verified by Registrar — forwarded to Subject Teacher',
  })

  // Notify the routed subject teacher (best-effort — never blocks).
  const { data: r } = await supabase
    .from('special_exam_requests')
    .select('teacher_id, subject_id, snap_name, profiles!student_id(full_name)')
    .eq('id', requestId)
    .maybeSingle()
  if (r) {
    const prof = r.profiles as unknown as { full_name: string } | null
    await notifyRequestVerified({
      teacherId: (r.teacher_id as string | null) ?? null,
      studentName: (r.snap_name as string | null) ?? prof?.full_name ?? 'A student',
      subjectId: r.subject_id as string,
    })
  }

  revalidatePath('/registrar')
  return { error: null }
}

// Verify every still-pending form for a student in one go. Only rows still at
// 'submitted' are touched (the .eq guard), so forms that already moved on are
// left alone. Returns how many were actually verified.
export async function verifyAll(requestIds: string[]) {
  const ctx = await requireRegistrar()
  if (!ctx) return { error: 'Unauthorized', count: 0 }
  const { supabase, userId, role } = ctx

  const ids = [...new Set(requestIds)].filter(Boolean)
  if (!ids.length) return { error: 'Nothing to verify.', count: 0 }

  const { data: updated, error } = await supabase
    .from('special_exam_requests')
    .update({ status: 'verified_by_registrar' })
    .in('id', ids)
    .eq('status', 'submitted')
    .select('id')

  if (error) return { error: error.message, count: 0 }
  const verified = updated ?? []
  if (!verified.length) return { error: 'These requests were already handled.', count: 0 }

  await supabase.from('progress_logs').insert(
    verified.map((u) => ({
      request_id: u.id,
      actor_id: userId,
      actor_role: role,
      action: 'Verified by Registrar — forwarded to Subject Teacher',
    }))
  )

  // Notify each routed teacher once, with how many of their forms just arrived.
  const { data: rows } = await supabase
    .from('special_exam_requests')
    .select('teacher_id, snap_name, profiles!student_id(full_name)')
    .in('id', verified.map((v) => v.id))
  const byTeacher = new Map<string, { studentName: string; count: number }>()
  for (const row of rows ?? []) {
    const teacherId = row.teacher_id as string | null
    if (!teacherId) continue
    const prof = row.profiles as unknown as { full_name: string } | null
    const name = (row.snap_name as string | null) ?? prof?.full_name ?? 'A student'
    const entry = byTeacher.get(teacherId)
    if (entry) entry.count++
    else byTeacher.set(teacherId, { studentName: name, count: 1 })
  }
  await Promise.all(
    [...byTeacher.entries()].map(([teacherId, v]) =>
      notifyTeacherVerifiedMany({ teacherId, studentName: v.studentName, count: v.count }),
    ),
  )

  revalidatePath('/registrar')
  return { error: null, count: verified.length }
}

export async function rejectRequest(requestId: string, reason: string) {
  const ctx = await requireRegistrar()
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
    action: `Rejected by Registrar: ${sanitizedReason}`,
  })

  revalidatePath('/registrar')
  return { error: null }
}
