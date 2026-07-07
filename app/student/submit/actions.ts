'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActivePeriod, computeWindow } from '@/lib/examSettings'
import type { ExcusedReason } from '@/lib/supabase/types'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

type DB = Awaited<ReturnType<typeof createClient>>

function hasUpload(file: File | null): boolean {
  return !!file && file.size > 0
}

// Validate a required file. On a resubmit, a slot with an existing file on
// record is optional (keptOnRecord = true) — but if a NEW file is provided it's
// still validated for type/size.
function validateFile(file: File | null, fieldName: string, keptOnRecord = false): string | null {
  if (!hasUpload(file)) {
    if (keptOnRecord) return null
    return `${fieldName} is required`
  }
  if (!ALLOWED_MIME.includes(file!.type)) return `${fieldName} must be JPG, PNG, or PDF`
  if (file!.size > MAX_BYTES) return `${fieldName} exceeds 5 MB`
  return null
}

async function uploadFile(supabase: DB, file: File, requestId: string, mediaType: string): Promise<{ path: string; error: string | null }> {
  // Sanitize the extension so a crafted filename can't influence the storage key
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
  const path = `requests/${requestId}/${mediaType}.${ext}`
  const { error } = await supabase.storage.from('exam-documents').upload(path, file, { contentType: file.type, upsert: true })
  return { path, error: error?.message ?? null }
}

export async function submitRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'student') return redirect('/login')

  // Enforce the active period's window server-side (the client button is also
  // disabled, but this is the real guard against a crafted request).
  const activePeriod = await getActivePeriod(supabase)
  const win = computeWindow(activePeriod?.submissionStart ?? null, activePeriod?.windowDays ?? 7)
  if (!activePeriod || !win.open) {
    return redirect(`/student/submit?error=${encodeURIComponent('Special exam submissions are not open right now.')}`)
  }

  const examType = String(formData.get('exam_type') ?? '')
  const subjectId = String(formData.get('subject_id') ?? '')
  const excusedReason = formData.get('excused_reason') as ExcusedReason | null
  const otherReason = String(formData.get('other_reason') ?? '').trim().slice(0, 500)

  if (!['paid', 'excused'].includes(examType)) return redirect('/student/submit?error=Invalid+exam+type')
  if (!subjectId) return redirect('/student/submit?error=Please+select+a+subject')

  const resubmitFrom = String(formData.get('resubmit_from') ?? '')

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
    snap_contact_number: String(formData.get('contact_number') ?? '').trim().slice(0, 40) || null,
  }

  const parentId = formData.get('parent_id') as File | null
  const parentIdBack = formData.get('parent_id_back') as File | null
  const parentSig = formData.get('parent_signature') as File | null
  const supportDoc = formData.get('supporting_document') as File | null
  const files = { parentId, parentIdBack, parentSig, supportDoc }

  // Resubmit path: edit the existing rejected request in place so its uploaded
  // files are kept — the student only re-uploads what they want to replace.
  if (resubmitFrom) {
    return resubmitRequest(supabase, user.id, resubmitFrom, {
      examType, subjectId, excusedReason, otherReason, snapshot, periodId: activePeriod.id,
    }, files)
  }

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

  if (errors.length) return redirect(`/student/submit?error=${encodeURIComponent(errors.join('; '))}`)

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
      period_id: activePeriod.id,
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
    return finishSubmission(supabase, retry.data, user.id, examType, files)
  }

  return finishSubmission(supabase, req, user.id, examType, files)
}

interface SubmissionFiles {
  parentId: File | null
  parentIdBack: File | null
  parentSig: File | null
  supportDoc: File | null
}

async function finishSubmission(supabase: DB, req: { id: string }, userId: string, examType: string, f: SubmissionFiles) {
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
  const filesArr = [f.parentId!, f.parentIdBack!, f.parentSig!, ...(examType === 'excused' && f.supportDoc ? [f.supportDoc] : [])]

  await supabase.from('application_media').insert(
    uploaded.map((u, i) => ({
      request_id: req.id,
      media_type: mediaTypes[i],
      storage_path: u.path,
      file_name: filesArr[i].name,
      mime_type: filesArr[i].type,
      size_bytes: filesArr[i].size,
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

interface ResubmitFields {
  examType: string
  subjectId: string
  excusedReason: ExcusedReason | null
  otherReason: string
  snapshot: Record<string, unknown>
  periodId: string
}

// Re-open a rejected request: keep its files, replace only the slots the student
// re-uploaded, reset it to 'submitted', and clear the rejection.
async function resubmitRequest(supabase: DB, userId: string, oldId: string, fields: ResubmitFields, f: SubmissionFiles) {
  const { data: old } = await supabase
    .from('special_exam_requests')
    .select('id, status')
    .eq('id', oldId)
    .eq('student_id', userId)
    .maybeSingle()
  if (!old || old.status !== 'rejected') {
    return redirect('/student/submit?error=' + encodeURIComponent('This request can no longer be resubmitted.'))
  }

  const { data: media } = await supabase.from('application_media').select('media_type').eq('request_id', oldId)
  const onRecord = new Set((media ?? []).map((m) => m.media_type))

  // Validate: a slot is required only if there's no file on record for it.
  const errors: string[] = []
  const idErr = validateFile(f.parentId, 'Valid ID (front)', onRecord.has('parent_id'))
  const backErr = validateFile(f.parentIdBack, 'Valid ID (back)', onRecord.has('parent_id_back'))
  const sigErr = validateFile(f.parentSig, 'Parent Signature', onRecord.has('parent_signature'))
  if (idErr) errors.push(idErr)
  if (backErr) errors.push(backErr)
  if (sigErr) errors.push(sigErr)
  if (fields.examType === 'excused') {
    if (!fields.excusedReason) errors.push('Reason is required for Excused exam')
    const docErr = validateFile(f.supportDoc, 'Supporting document', onRecord.has('supporting_document'))
    if (docErr) errors.push(docErr)
  }
  if (errors.length) return redirect(`/student/submit?from=${oldId}&error=${encodeURIComponent(errors.join('; '))}`)

  // Reset the request back into the queue with the (possibly edited) details.
  const baseUpdate = {
    subject_id: fields.subjectId,
    exam_type: fields.examType as 'paid' | 'excused',
    excused_reason: fields.excusedReason,
    other_reason: fields.examType === 'excused' && fields.excusedReason === 'other' ? fields.otherReason : null,
    status: 'submitted' as const,
    rejection_reason: null,
    rejected_by_role: null,
    period_id: fields.periodId,
    submitted_at: new Date().toISOString(),
  }
  let { error: updErr } = await supabase.from('special_exam_requests').update({ ...baseUpdate, ...fields.snapshot }).eq('id', oldId).eq('student_id', userId)
  if (updErr) {
    // Snapshot columns may not be migrated — retry without them.
    ({ error: updErr } = await supabase.from('special_exam_requests').update(baseUpdate).eq('id', oldId).eq('student_id', userId))
    if (updErr) return redirect(`/student/submit?from=${oldId}&error=${encodeURIComponent(updErr.message)}`)
  }

  // Replace only the slots that got a new upload.
  const slots: { file: File | null; type: string }[] = [
    { file: f.parentId, type: 'parent_id' },
    { file: f.parentIdBack, type: 'parent_id_back' },
    { file: f.parentSig, type: 'parent_signature' },
    { file: f.supportDoc, type: 'supporting_document' },
  ]
  for (const s of slots) {
    if (!hasUpload(s.file)) continue
    const up = await uploadFile(supabase, s.file!, oldId, s.type)
    if (up.error) return redirect(`/student/submit?from=${oldId}&error=${encodeURIComponent('File upload failed: ' + up.error)}`)
    await supabase.from('application_media').delete().eq('request_id', oldId).eq('media_type', s.type)
    await supabase.from('application_media').insert({
      request_id: oldId,
      media_type: s.type,
      storage_path: up.path,
      file_name: s.file!.name,
      mime_type: s.file!.type,
      size_bytes: s.file!.size,
    })
  }

  await supabase.from('progress_logs').insert({
    request_id: oldId,
    actor_id: userId,
    actor_role: 'student',
    action: 'Resubmitted after rejection',
  })

  redirect(`/student/requests/${oldId}?submitted=1`)
}
