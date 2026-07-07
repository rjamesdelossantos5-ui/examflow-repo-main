'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

export async function deleteRequest(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Only the owner can delete, and only while still 'submitted' (enforced by RLS too)
  const { data: req } = await supabase
    .from('special_exam_requests')
    .select('id, status, student_id')
    .eq('id', requestId)
    .eq('student_id', user.id)
    .single()

  if (!req) return { error: 'Request not found' }
  if (!['submitted', 'rejected'].includes(req.status)) {
    return { error: 'You can only remove a request while it is pending, or after it was rejected.' }
  }

  // Best-effort cleanup of uploaded files
  const { data: media } = await supabase
    .from('application_media')
    .select('storage_path')
    .eq('request_id', requestId)
  const paths = (media ?? []).map((m) => m.storage_path).filter(Boolean)
  if (paths.length) {
    await supabase.storage.from('exam-documents').remove(paths)
  }

  // Deleting the request cascades media + progress logs
  const { error } = await supabase
    .from('special_exam_requests')
    .delete()
    .eq('id', requestId)
    .eq('student_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/student')
  redirect('/student')
}

export async function uploadReceipt(requestId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'student') return { error: 'Unauthorized' }

  const file = formData.get('payment_receipt') as File | null
  if (!file || file.size === 0) return { error: 'File is required' }
  if (!ALLOWED_MIME.includes(file.type)) return { error: 'Only JPG, PNG, or PDF allowed' }
  if (file.size > MAX_BYTES) return { error: 'File exceeds 5 MB' }

  const { data: req } = await supabase
    .from('special_exam_requests')
    .select('id, status, exam_type')
    .eq('id', requestId)
    .eq('student_id', user.id)
    .single()

  if (!req) return { error: 'Request not found' }
  if (req.exam_type !== 'paid') return { error: 'Only Paid requests require a receipt' }
  if (req.status !== 'accepted') return { error: 'Receipt upload not available at this stage' }

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
  const path = `requests/${requestId}/payment_receipt.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('exam-documents')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (uploadErr) return { error: uploadErr.message }

  // Re-uploads (after a rejected receipt) reuse the same storage path, but the
  // media row must be replaced — otherwise duplicate 'payment_receipt' rows pile
  // up. Clear any prior receipt row before recording the new one.
  await supabase
    .from('application_media')
    .delete()
    .eq('request_id', requestId)
    .eq('media_type', 'payment_receipt')

  await supabase.from('application_media').insert({
    request_id: requestId,
    media_type: 'payment_receipt',
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  })

  // Clear any prior receipt-rejection note now that a fresh receipt is in.
  await supabase.from('special_exam_requests').update({ status: 'receipt_uploaded', rejection_reason: null }).eq('id', requestId)

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: user.id,
    actor_role: 'student',
    action: 'Uploaded payment receipt',
  })

  revalidatePath(`/student/requests/${requestId}`)
  return { error: null }
}
