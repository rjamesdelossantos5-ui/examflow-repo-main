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
  // Sanitize the extension so a crafted filename can't influence the storage key
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
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

  // NOTE: submission-window enforcement is not implemented yet. It needs a
  // last-period-start date in `settings` to compare against; until then we read
  // nothing here (the previous unused `settings` fetch was removed).

  const examType = String(formData.get('exam_type') ?? '')
  const subjectId = String(formData.get('subject_id') ?? '')
  const excusedReason = formData.get('excused_reason') as ExcusedReason | null
  const otherReason = String(formData.get('other_reason') ?? '').trim().slice(0, 500)

  if (!['paid', 'excused'].includes(examType)) {
    return redirect('/student/submit?error=Invalid+exam+type')
  }
  if (!subjectId) return redirect('/student/submit?error=Please+select+a+subject')

  // Snapshot the student details entered on THIS form (does not touch the
  // profile, so older requests keep the name/section they were submitted with).
  const yearRaw = String(formData.get('year_level') ?? '').trim()
  const yearNum = yearRaw ? Number(yearRaw) : null
  const snapshot = {
    snap_name: String(formData.get('full_name') ?? '').trim().slice(0, 120) || null,
    snap_student_number: String(formData.get('student_number') ?? '').trim().slice(0, 40) || null,
    snap_course: String(formData.get('course') ?? '').trim().slice(0, 60) || null,
    snap_year_level: Number.isInteger(yearNum) && yearNum! >= 1 && yearNum! <= 6 ? yearNum : null,
    snap_section: String(formData.get('section') ?? '').trim().slice(0, 20) || null,
  }

  // Validate files
  const parentId = formData.get('parent_id') as File | null
  const parentIdBack = formData.get('parent_id_back') as File | null
  const parentSig = formData.get('parent_signature') as File | null
  const supportDoc = formData.get('supporting_document') as File | null

  const errors: string[] = []
  const idErr = validateFile(parentId, 'Valid ID (front)')
  const backErr = validateFile(parentIdBack, 'Valid ID (back)')
  const sigErr = validateFile(parentSig, 'Parent Signature')
  if (idErr) errors.push(idErr)
  if (backErr) errors.push(backErr)
  if (sigErr) errors.push(sigErr)

  if (examType === 'excused') {
    if (!excusedReason) errors.push('Reason is required for Excused exam')
    const docErr = validateFile(supportDoc, 'Supporting document')
    if (docErr) errors.push(docErr)
  }

  if (errors.length) {
    return redirect(`/student/submit?error=${encodeURIComponent(errors.join('; '))}`)
  }

  // Insert request (with the per-form snapshot of student details)
  const { data: req, error: reqErr } = await supabase
    .from('special_exam_requests')
    .insert({
      student_id: user.id,
      subject_id: subjectId,
      exam_type: examType as 'paid' | 'excused',
      excused_reason: excusedReason,
      other_reason: examType === 'excused' && excusedReason === 'other' ? otherReason : null,
      status: 'submitted',
      ...snapshot,
    })
    .select()
    .single()

  if (reqErr || !req) {
    // If the snapshot columns aren't migrated yet, retry without them so
    // submissions never break (see supabase/migration_snapshot.sql).
    const retry = await supabase
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
    if (retry.error || !retry.data) {
      return redirect(`/student/submit?error=${encodeURIComponent(retry.error?.message ?? 'Submission failed')}`)
    }
    return finishSubmission(supabase, retry.data, user.id, examType, { parentId, parentIdBack, parentSig, supportDoc })
  }

  return finishSubmission(supabase, req, user.id, examType, { parentId, parentIdBack, parentSig, supportDoc })
}

interface SubmissionFiles {
  parentId: File | null
  parentIdBack: File | null
  parentSig: File | null
  supportDoc: File | null
}

async function finishSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  req: { id: string },
  userId: string,
  examType: string,
  f: SubmissionFiles,
) {
  // Upload documents (front + back of ID, signature, optional supporting doc)
  const uploads: Promise<{ path: string; error: string | null }>[] = [
    uploadFile(supabase, f.parentId!, req.id, 'parent_id'),
    uploadFile(supabase, f.parentIdBack!, req.id, 'parent_id_back'),
    uploadFile(supabase, f.parentSig!, req.id, 'parent_signature'),
  ]
  if (examType === 'excused' && f.supportDoc) {
    uploads.push(uploadFile(supabase, f.supportDoc, req.id, 'supporting_document'))
  }

  const uploaded = await Promise.all(uploads)
  const uploadErrors = uploaded.filter((u) => u.error)
  if (uploadErrors.length) {
    await supabase.from('special_exam_requests').delete().eq('id', req.id)
    return redirect(`/student/submit?error=${encodeURIComponent('File upload failed: ' + uploadErrors[0].error)}`)
  }

  const mediaTypes = ['parent_id', 'parent_id_back', 'parent_signature', ...(examType === 'excused' && f.supportDoc ? ['supporting_document'] : [])]
  const files = [f.parentId!, f.parentIdBack!, f.parentSig!, ...(examType === 'excused' && f.supportDoc ? [f.supportDoc] : [])]

  await supabase.from('application_media').insert(
    uploaded.map((u, i) => ({
      request_id: req.id,
      media_type: mediaTypes[i],
      storage_path: u.path,
      file_name: files[i].name,
      mime_type: files[i].type,
      size_bytes: files[i].size,
    }))
  )

  await supabase.from('progress_logs').insert({
    request_id: req.id,
    actor_id: userId,
    actor_role: 'student',
    action: 'Submitted special exam request',
  })

  redirect(`/student/requests/${req.id}?submitted=1`)
}
