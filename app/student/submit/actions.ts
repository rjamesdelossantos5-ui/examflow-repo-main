'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ExcusedReason } from '@/lib/supabase/types'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

function validateFile(file: File | null, fieldName: string): string | null {
  if (!file || file.size === 0) return `${fieldName} is required`
  if (!ALLOWED_MIME.includes(file.type)) return `${fieldName} must be JPG, PNG, or PDF`
  if (file.size > MAX_BYTES) return `${fieldName} exceeds 5 MB`
  return null
}

async function uploadFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  requestId: string,
  mediaType: string
): Promise<{ path: string; error: string | null }> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `requests/${requestId}/${mediaType}.${ext}`

  const { error } = await supabase.storage
    .from('exam-documents')
    .upload(path, file, { contentType: file.type, upsert: true })

  return { path, error: error?.message ?? null }
}

export async function submitRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'student') return redirect('/login')

  // Check submission window
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'submission_window_days')
    .single()
  // (Enforcement logic can be added with a last-period-start date in settings)

  const examType = String(formData.get('exam_type') ?? '')
  const subjectId = String(formData.get('subject_id') ?? '')
  const excusedReason = formData.get('excused_reason') as ExcusedReason | null
  const otherReason = String(formData.get('other_reason') ?? '').trim().slice(0, 500)

  if (!['paid', 'excused'].includes(examType)) {
    return redirect('/student/submit?error=Invalid+exam+type')
  }
  if (!subjectId) return redirect('/student/submit?error=Please+select+a+subject')

  // Validate files
  const parentId = formData.get('parent_id') as File | null
  const parentSig = formData.get('parent_signature') as File | null
  const supportDoc = formData.get('supporting_document') as File | null

  const errors: string[] = []
  const idErr = validateFile(parentId, 'Parent/Guardian ID')
  const sigErr = validateFile(parentSig, 'Parent Signature')
  if (idErr) errors.push(idErr)
  if (sigErr) errors.push(sigErr)

  if (examType === 'excused') {
    if (!excusedReason) errors.push('Reason is required for Excused exam')
    const docErr = validateFile(supportDoc, 'Supporting document')
    if (docErr) errors.push(docErr)
  }

  if (errors.length) {
    return redirect(`/student/submit?error=${encodeURIComponent(errors.join('; '))}`)
  }

  // Insert request
  const { data: req, error: reqErr } = await supabase
    .from('special_exam_requests')
    .insert({
      student_id: user.id,
      subject_id: subjectId,
      exam_type: examType as 'paid' | 'excused',
      excused_reason: excusedReason,
      other_reason: examType === 'excused' && excusedReason === 'other' ? otherReason : null,
      status: 'submitted',
    })
    .select()
    .single()

  if (reqErr || !req) {
    return redirect(`/student/submit?error=${encodeURIComponent(reqErr?.message ?? 'Submission failed')}`)
  }

  // Upload files
  const uploads: Promise<{ path: string; error: string | null }>[] = [
    uploadFile(supabase, parentId!, req.id, 'parent_id'),
    uploadFile(supabase, parentSig!, req.id, 'parent_signature'),
  ]
  if (examType === 'excused' && supportDoc) {
    uploads.push(uploadFile(supabase, supportDoc, req.id, 'supporting_document'))
  }

  const uploaded = await Promise.all(uploads)
  const uploadErrors = uploaded.filter((u) => u.error)
  if (uploadErrors.length) {
    await supabase.from('special_exam_requests').delete().eq('id', req.id)
    return redirect(`/student/submit?error=${encodeURIComponent('File upload failed: ' + uploadErrors[0].error)}`)
  }

  // Save media records
  const mediaTypes = ['parent_id', 'parent_signature', ...(examType === 'excused' && supportDoc ? ['supporting_document'] : [])]
  const files = [parentId!, parentSig!, ...(examType === 'excused' && supportDoc ? [supportDoc] : [])]

  await supabase.from('application_media').insert(
    uploaded.map((u, i) => ({
      request_id: req.id,
      media_type: mediaTypes[i] as 'parent_id' | 'parent_signature' | 'supporting_document',
      storage_path: u.path,
      file_name: files[i].name,
      mime_type: files[i].type,
      size_bytes: files[i].size,
    }))
  )

  // Log
  await supabase.from('progress_logs').insert({
    request_id: req.id,
    actor_id: user.id,
    actor_role: 'student',
    action: 'Submitted special exam request',
  })

  redirect(`/student/requests/${req.id}?submitted=1`)
}
