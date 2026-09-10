'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'
import {
  createVerificationSession,
  getSessionDecision,
  summarizeDecision,
  isApproved,
} from '@/lib/didit'

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

  if (error) return { error: friendlyError('deleteRequest', error, `We couldn't remove this request. ${RETRY_HINT}`) }

  revalidatePath('/student')
  // Also drop the detail route from the client router cache. Without this, the
  // browser Back button re-served the deleted request from cache as if it still
  // existed; on refetch it hit notFound() instead. Now Back refetches and lands
  // on the friendly "no longer available" page (see not-found.tsx here).
  revalidatePath('/student/requests/[id]', 'page')
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

  if (uploadErr) return { error: friendlyError('uploadReceipt', uploadErr, `We couldn't upload your receipt. Check your connection and try again.`) }

  // Re-uploads (after a rejected receipt) reuse the same storage path, and the
  // media row must be REPLACED — otherwise duplicate 'payment_receipt' rows pile
  // up. This was a delete-then-insert, which silently duplicated: there was no
  // RLS delete policy on application_media, so the delete removed nothing.
  // Upserting on the (request_id, media_type) unique index can't duplicate at
  // all — see supabase/migration_media_dedupe.sql.
  await supabase.from('application_media').upsert({
    request_id: requestId,
    media_type: 'payment_receipt',
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_at: new Date().toISOString(),
  }, { onConflict: 'request_id,media_type' })

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

// ─────────────────────────────────────────────────────────────────────────────
// PARENT IDENTITY VERIFICATION (Didit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Starts a verification and returns the hosted Didit URL for the browser to
 * navigate to.
 *
 * It returns the URL rather than calling redirect(). A Server Action is invoked
 * by a form POST, and Chrome and Safari apply `form-action 'self'` (see
 * next.config.ts) to the redirect that FOLLOWS a form submission — so
 * redirect('https://verify.didit.me/...') from here is blocked in those
 * browsers. Firefox allows it, which makes it exactly the kind of bug that
 * passes local testing and fails for most users. The caller navigates with
 * window.location.href, which is an ordinary navigation and unaffected.
 */
export async function startParentVerification(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { url: null, error: 'Unauthorized' }

  const { data: req } = await supabase
    .from('special_exam_requests')
    .select('id, student_id, status, didit_status')
    .eq('id', requestId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (!req) return { url: null, error: 'Request not found' }
  // Don't spend a second check on a request that already passed — the free tier
  // is 500 sessions/month and a re-verification would overwrite a good result.
  if (isApproved(req.didit_status)) {
    return { url: null, error: 'This request has already been verified.' }
  }

  // Absolute callback URL, derived from the incoming request so it is correct in
  // local dev, on a Vercel preview, and in production without another env var.
  const h = await headers()
  const host = h.get('host')
  if (!host) return { url: null, error: `We couldn't start verification. ${RETRY_HINT}` }
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const callbackUrl = `${proto}://${host}/student/requests/${requestId}?verified=1`

  const { session, error } = await createVerificationSession({
    // vendor_data doubles as Didit's idempotency key: an unfinished session for
    // the same request is returned again instead of a new one being created, so
    // a parent who abandons and retries doesn't burn a second check.
    vendorData: requestId,
    callbackUrl,
    metadata: { request_id: requestId },
  })
  if (error || !session) return { url: null, error: error ?? `We couldn't start verification. ${RETRY_HINT}` }

  // Record the session id BEFORE sending the parent onward. This is the only
  // link between Didit's webhook and this request — if the write fails, the
  // result comes back and matches nothing, so bail out instead.
  const { error: updErr } = await supabase
    .from('special_exam_requests')
    .update({ didit_session_id: session.session_id, didit_status: session.status ?? 'Not Started' })
    .eq('id', requestId)
    .eq('student_id', user.id)

  if (updErr) {
    return { url: null, error: friendlyError('startParentVerification', updErr, `We couldn't start verification. ${RETRY_HINT}`) }
  }

  revalidatePath(`/student/requests/${requestId}`)
  return { url: session.url, error: null }
}

/**
 * Re-reads the decision from Didit and stores it.
 *
 * The webhook is the primary path; this is the safety net for when it doesn't
 * arrive — a misconfigured destination, a deploy mid-flight, or the parent
 * finishing faster than delivery. It asks Didit's API directly rather than
 * trusting the `?status=` query param the browser comes back with, which Didit's
 * own docs call an "untrusted UI hint".
 */
export async function refreshParentVerification(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: req } = await supabase
    .from('special_exam_requests')
    .select('id, didit_session_id')
    .eq('id', requestId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (!req?.didit_session_id) return { error: 'No verification has been started for this request.' }

  const { status, decision, error } = await getSessionDecision(req.didit_session_id)
  if (error || !status) return { error: error ?? 'Could not read the verification result.' }

  const summary = summarizeDecision(decision)
  const { error: updErr } = await supabase
    .from('special_exam_requests')
    .update({
      didit_status: status,
      didit_checked_at: new Date().toISOString(),
      didit_liveness_score: summary.livenessScore,
      didit_face_match_score: summary.faceMatchScore,
      didit_document_type: summary.documentType,
      didit_id_name: summary.idName,
      didit_warnings: summary.warnings,
    })
    .eq('id', requestId)
    .eq('student_id', user.id)

  if (updErr) return { error: friendlyError('refreshParentVerification', updErr, `We couldn't refresh the result. ${RETRY_HINT}`) }

  revalidatePath(`/student/requests/${requestId}`)
  return { error: null }
}
