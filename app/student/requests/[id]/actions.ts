'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'
import { createVerificationSession, isApproved } from '@/lib/didit'
import { syncDiditResult } from '@/lib/diditSync'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

/** Shape uploadReceipt needs. Declared here rather than inferred from the query,
 *  because the fallback path selects fewer columns and `typeof` on a narrowed
 *  `let` collapses to `never`. Not exported: a 'use server' module may only
 *  export async functions. */
type ReceiptRequest = {
  status: string
  exam_type: string
  payment_assessed_at?: string | null
}

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

  // payment_assessed_at may not exist yet (migration_payment_assessment.sql).
  // Select it separately so an unmigrated database still allows receipt uploads
  // exactly as before, instead of blocking every student on a missing column.
  let req: ReceiptRequest | null = null
  let assessmentEnforced = true
  {
    const res = await supabase
      .from('special_exam_requests')
      .select('id, status, exam_type, payment_assessed_at')
      .eq('id', requestId)
      .eq('student_id', user.id)
      .maybeSingle()
    if (res.error) {
      assessmentEnforced = false
      const legacy = await supabase
        .from('special_exam_requests')
        .select('id, status, exam_type')
        .eq('id', requestId)
        .eq('student_id', user.id)
        .maybeSingle()
      req = legacy.data as ReceiptRequest | null
    } else {
      req = res.data as ReceiptRequest | null
    }
  }

  if (!req) return { error: 'Request not found' }
  if (req.exam_type !== 'paid') return { error: 'Only Paid requests require a receipt' }
  if (req.status !== 'accepted') return { error: 'Receipt upload not available at this stage' }
  // The Registrar's second touch. They total every accepted paid subject this
  // student has and pass one figure to the Cashier — so a student must not pay
  // for one subject while owing for three. Blocking the upload is what enforces
  // the real-world order.
  if (assessmentEnforced && !req.payment_assessed_at) {
    return { error: 'The Registrar has not assessed your fees yet. Visit the Registrar before paying at the Cashier.' }
  }

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
    .select('id, student_id, status, didit_status, didit_session_id')
    .eq('id', requestId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (!req) return { url: null, error: 'Request not found' }
  // Don't spend a second check on a request that already passed — the free tier
  // is 500 sessions/month and a re-verification would overwrite a good result.
  //
  // Ask Didit how the EXISTING session ended before starting another. Starting
  // a new one overwrites didit_session_id, and the webhook finds its request by
  // that id — so an Approved result for the old session would then match
  // nothing and be dropped for good. That is how a parent who had just passed
  // could be sent round to verify again, with the pass lost behind them.
  let currentStatus = req.didit_status as string | null
  if (req.didit_session_id && !isApproved(currentStatus)) {
    const synced = await syncDiditResult(supabase, requestId, user.id, req.didit_session_id as string)
    if (synced.fields) currentStatus = synced.fields.didit_status
  }
  if (isApproved(currentStatus)) {
    // Not an error: the result was already in. Re-render and the page shows it.
    revalidatePath(`/student/requests/${requestId}`)
    return { url: null, error: null, alreadyVerified: true }
  }

  // Absolute callback URL, derived from the incoming request so it is correct in
  // local dev, on a Vercel preview, and in production without another env var.
  const h = await headers()
  const host = h.get('host')
  if (!host) return { url: null, error: `We couldn't start verification. ${RETRY_HINT}` }
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const callbackUrl = `${proto}://${host}/student/requests/${requestId}?verified=1`

  const { session, error } = await createVerificationSession({
    // vendor_data ties every session back to this request on Didit's side (their
    // console can filter by it). It is NOT relied on as an idempotency key: Didit's
    // documentation does not say that reusing it returns an existing session, and
    // an earlier version of this comment claimed it did without that ever being
    // verified. The guard against losing a result is the sync above.
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

  const { error } = await syncDiditResult(supabase, requestId, user.id, req.didit_session_id as string)
  if (error) return { error: `${error} ${RETRY_HINT}` }

  revalidatePath(`/student/requests/${requestId}`)
  return { error: null }
}

/**
 * The final step: the student confirms submission after their parent has passed
 * verification. This is what actually puts the request in front of the Registrar.
 *
 * Splitting it from form-filling is what makes the button labels honest. Filling
 * in the form creates the row — Didit needs something to attach a session to —
 * but it is not a submission until this runs.
 */
export async function confirmSubmission(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: req } = await supabase
    .from('special_exam_requests')
    .select('id, status, didit_status, student_confirmed_at')
    .eq('id', requestId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (!req) return { error: 'Request not found' }
  if (req.student_confirmed_at) return { error: null } // already submitted; nothing to do

  // The gate. A student cannot reach the Registrar by calling this directly —
  // the parent has to have passed first.
  if (!isApproved(req.didit_status)) {
    return { error: 'Your parent or guardian must be verified before this can be submitted.' }
  }

  const { error } = await supabase
    .from('special_exam_requests')
    .update({ student_confirmed_at: new Date().toISOString(), submitted_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('student_id', user.id)

  if (error) return { error: friendlyError('confirmSubmission', error, `We couldn't submit this request. ${RETRY_HINT}`) }

  await supabase.from('progress_logs').insert({
    request_id: requestId,
    actor_id: user.id,
    actor_role: 'student',
    action: 'Submitted to the Registrar after parent verification',
  })

  revalidatePath(`/student/requests/${requestId}`)
  revalidatePath('/student')
  revalidatePath('/registrar')
  return { error: null }
}
