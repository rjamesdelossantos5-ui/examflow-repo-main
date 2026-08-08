'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActivePeriod, computeWindow } from '@/lib/examSettings'
import { isValidPhone, isValidStudentNumber } from '@/lib/validation'
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

// The teacher a request routes to = the instructor of the chosen (subject,
// section) offering. Null when there's no matching offering (falls back to the
// subject's own teacher via RLS).
async function resolveOfferingTeacher(supabase: DB, subjectId: string, section: string | null): Promise<string | null> {
  if (!section) return null
  const { data } = await supabase
    .from('class_offerings')
    .select('teacher_id')
    .eq('subject_id', subjectId)
    .eq('section', section)
    .maybeSingle()
  return (data as { teacher_id: string | null } | null)?.teacher_id ?? null
}

async function uploadFile(supabase: DB, file: File, requestId: string, mediaType: string): Promise<{ path: string; error: string | null }> {
  // Sanitize the extension so a crafted filename can't influence the storage key
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
  const path = `requests/${requestId}/${mediaType}.${ext}`
  const { error } = await supabase.storage.from('exam-documents').upload(path, file, { contentType: file.type, upsert: true })
  // Storage errors are shown to the student, so keep them plain — the real one
  // goes to the server log for debugging.
  if (error) {
    console.error(`[uploadFile:${mediaType}]`, error)
    return { path, error: 'the upload did not complete. Check your connection and try again.' }
  }
  return { path, error: null }
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

  // Reject garbage in the free-text identity fields (the client also checks, but
  // this server guard is what actually stops a crafted POST). Contact number is
  // required; student number is optional but must look like one if given.
  const fieldErrors: string[] = []
  if (!isValidPhone(snapshot.snap_contact_number ?? '')) {
    fieldErrors.push('Enter a valid contact number (e.g. 09171234567).')
  }
  if (snapshot.snap_student_number && !isValidStudentNumber(snapshot.snap_student_number)) {
    fieldErrors.push('Enter a valid student number (digits only, e.g. 2024-00001).')
  }
  if (fieldErrors.length) {
    const back = resubmitFrom ? `&from=${resubmitFrom}` : ''
    return redirect(`/student/submit?error=${encodeURIComponent(fieldErrors.join(' '))}${back}`)
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

  // One request per subject per term. A student can't file a brand-new request
  // for a subject they already submitted this term — a rejected one must be
  // fixed via Edit & Resubmit (which reuses that row), not duplicated. This
  // only guards the NEW-submission path; the resubmit branch above is exempt.
  const { data: dupes, error: dupeErr } = await supabase
    .from('special_exam_requests')
    .select('id, status')
    .eq('student_id', user.id)
    .eq('subject_id', subjectId)
    .eq('period_id', activePeriod.id)
    .limit(1)
  const dupe = dupes?.[0]
  // If the period_id column isn't migrated, dupeErr is set — fail open rather
  // than block every submission.
  if (!dupeErr && dupe) {
    const msg = dupe.status === 'rejected'
      ? 'You already have a request for this subject this term. Open it and use “Edit & Resubmit” instead of filing a new one.'
      : 'You already have a request for this subject this term.'
    return redirect(`/student/submit?error=${encodeURIComponent(msg)}`)
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

  // Route to the chosen section's teacher.
  const routedTeacherId = await resolveOfferingTeacher(supabase, subjectId, snapshot.snap_section)

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
      teacher_id: routedTeacherId,
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
  // Fetch the rejected request WITH its current values so we can tell whether
  // the student actually changed anything on this resubmit.
  const OLD_COLS = 'id, status, subject_id, exam_type, excused_reason, other_reason, snap_name, snap_student_number, snap_course, snap_year_level, snap_section, snap_contact_number'
  let hasSnapshotCols = true
  let oldRow: Record<string, unknown> | null = null
  {
    const res = await supabase.from('special_exam_requests').select(OLD_COLS).eq('id', oldId).eq('student_id', userId).maybeSingle()
    if (res.error || !res.data) {
      // Snapshot columns may not be migrated on older DBs — retry with core fields.
      hasSnapshotCols = false
      const res2 = await supabase.from('special_exam_requests').select('id, status, subject_id, exam_type, excused_reason, other_reason').eq('id', oldId).eq('student_id', userId).maybeSingle()
      oldRow = (res2.data as Record<string, unknown> | null)
    } else {
      oldRow = res.data as Record<string, unknown>
    }
  }
  if (!oldRow || oldRow.status !== 'rejected') {
    return redirect('/student/submit?error=' + encodeURIComponent('This request can no longer be resubmitted.'))
  }

  // A resubmit must actually differ from the rejected request — either a new
  // document is uploaded OR some field is edited. Re-submitting the exact same
  // thing is blocked, since the reviewer rejected it for a reason.
  const norm = (v: unknown) => (v == null ? '' : String(v).trim())
  const snap = fields.snapshot as {
    snap_name?: string | null; snap_student_number?: string | null; snap_course?: string | null
    snap_year_level?: number | null; snap_section?: string | null; snap_contact_number?: string | null
  }
  const effectiveOther = fields.examType === 'excused' && fields.excusedReason === 'other' ? fields.otherReason : ''
  const fileChanged = hasUpload(f.parentId) || hasUpload(f.parentIdBack) || hasUpload(f.parentSig) || hasUpload(f.supportDoc)
  let fieldsChanged =
    fields.subjectId !== oldRow.subject_id ||
    fields.examType !== oldRow.exam_type ||
    norm(fields.excusedReason) !== norm(oldRow.excused_reason) ||
    norm(effectiveOther) !== norm(oldRow.other_reason)
  if (hasSnapshotCols) {
    fieldsChanged = fieldsChanged ||
      norm(snap.snap_name) !== norm(oldRow.snap_name) ||
      norm(snap.snap_student_number) !== norm(oldRow.snap_student_number) ||
      norm(snap.snap_course) !== norm(oldRow.snap_course) ||
      norm(snap.snap_year_level) !== norm(oldRow.snap_year_level) ||
      norm(snap.snap_section) !== norm(oldRow.snap_section) ||
      norm(snap.snap_contact_number) !== norm(oldRow.snap_contact_number)
  }
  if (!fileChanged && !fieldsChanged) {
    return redirect(`/student/submit?from=${oldId}&error=${encodeURIComponent('Nothing changed — edit a detail or re-upload a document before resubmitting.')}`)
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
  const routedTeacherId = await resolveOfferingTeacher(supabase, fields.subjectId, (fields.snapshot.snap_section as string | null) ?? null)
  const baseUpdate = {
    subject_id: fields.subjectId,
    exam_type: fields.examType as 'paid' | 'excused',
    excused_reason: fields.excusedReason,
    other_reason: fields.examType === 'excused' && fields.excusedReason === 'other' ? fields.otherReason : null,
    status: 'submitted' as const,
    rejection_reason: null,
    rejected_by_role: null,
    period_id: fields.periodId,
    teacher_id: routedTeacherId,
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
