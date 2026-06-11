'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

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

  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `requests/${requestId}/payment_receipt.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('exam-documents')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (uploadErr) return { error: uploadErr.message }

  await supabase.from('application_media').insert({
    request_id: requestId,
    media_type: 'payment_receipt',
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  })

  await supabase.from('special_exam_requests').update({ status: 'receipt_uploaded' }).eq('id', requestId)

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: user.id,
    actor_role: 'student',
    action: 'Uploaded payment receipt',
  })

  revalidatePath(`/student/requests/${requestId}`)
  return { error: null }
}
