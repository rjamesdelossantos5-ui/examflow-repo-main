'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { startParentVerification, refreshParentVerification, confirmSubmission } from './actions'

interface Props {
  requestId: string
  status: string | null
  livenessScore: number | null
  faceMatchScore: number | null
  documentType: string | null
  warnings: unknown
  /** True once the student has pressed "Submit Request" — i.e. the request has
   *  actually been sent to the Registrar. Passing verification alone does not
   *  submit it. */
  confirmed: boolean
  /** Set when the student arrived straight from the submit form (?verify=1).
   *  Opens Didit on mount instead of waiting for a button press. */
  autoStart?: boolean
}

/** Mirrors lib/didit.ts — matching is case-insensitive because Didit's own docs
 *  disagree on the casing of "Kyc Expired". */
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

type Phase = 'idle' | 'pending' | 'approved' | 'declined' | 'review'

function phaseOf(status: string | null): Phase {
  switch (norm(status)) {
    case 'approved': return 'approved'
    case 'declined': return 'declined'
    case 'in review': return 'review'
    case 'in progress':
    case 'awaiting user':
    case 'resubmitted': return 'pending'
    // 'Not Started', 'Abandoned', 'Expired', 'Kyc Expired' and null all mean
    // "nothing usable on record" — the parent simply starts (or restarts).
    default: return 'idle'
  }
}

export default function VerifyParent({
  requestId, status, livenessScore, faceMatchScore, documentType, warnings, confirmed, autoStart,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [leaving, setLeaving] = useState(false)
  const phase = phaseOf(status)

  function handleStart() {
    setError(null)
    startTransition(async () => {
      const res = await startParentVerification(requestId)
      if (res.error || !res.url) {
        setError(res.error ?? 'Could not start verification.')
        return
      }
      // A plain navigation, NOT redirect() from the server action: Chrome and
      // Safari block cross-origin redirects that follow a form POST under
      // `form-action 'self'` (next.config.ts). Firefox allows them, so doing it
      // the other way would work in testing and fail for most students.
      setLeaving(true)
      window.location.href = res.url
    })
  }

  function handleRefresh() {
    setError(null)
    startTransition(async () => {
      const res = await refreshParentVerification(requestId)
      if (res.error) setError(res.error)
    })
  }

  // Arrived from the submit form via ?verify=1 — open Didit straight away.
  //
  // The ref guard matters: without it React's strict-mode double-invoke, or any
  // re-render, would fire a second createVerificationSession. Didit dedupes on
  // vendor_data so it wouldn't create two sessions, but it would still be a
  // wasted round-trip and a second navigation.
  //
  // Skipped whenever phase isn't 'idle', so a request that already passed (or is
  // mid-flight) never gets bounced back out to Didit — which is what makes the
  // resubmit path safe.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoStart || autoStarted.current || phase !== 'idle') return
    autoStarted.current = true
    startTransition(async () => {
      const res = await startParentVerification(requestId)
      if (res.error || !res.url) {
        setError(res.error ?? 'Could not start verification.')
        return
      }
      setLeaving(true)
      window.location.href = res.url
    })
  }, [autoStart, phase, requestId])

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const res = await confirmSubmission(requestId)
      if (res.error) setError(res.error)
    })
  }

  const warningList = Array.isArray(warnings)
    ? (warnings as Array<{ short_description?: string; long_description?: string; feature?: string }>)
    : []

  // ── Verified ───────────────────────────────────────────────────────────────
  if (phase === 'approved') {
    return (
      <div className="ef-card rounded-xl p-6">
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 dark:bg-green-500/10 dark:border-green-500/30">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            ✓ Parent/guardian identity verified
          </p>
          <p className="mt-1 text-xs text-green-700/80 dark:text-green-300/80">
            A live identity check confirmed the person present matched the ID they presented.
            {documentType ? ` Document: ${documentType}.` : ''}
            {confirmed ? ' Your request is now with the Registrar.' : ''}
          </p>
          {(livenessScore != null || faceMatchScore != null) && (
            <p className="mt-2 text-xs text-green-700/80 dark:text-green-300/80">
              {livenessScore != null && <span>Liveness {livenessScore}</span>}
              {livenessScore != null && faceMatchScore != null && <span> · </span>}
              {faceMatchScore != null && <span>Face match {faceMatchScore}</span>}
            </p>
          )}
        </div>

        {/* Verified but not yet submitted. This is the last step, and it is
            genuinely easy to walk away from — so it states plainly that nothing
            has been sent yet rather than relying on the button alone. */}
        {!confirmed && (
          <>
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
              <strong>One step left.</strong> Your request has <strong>not</strong> been sent to the Registrar yet.
              Press Submit below to send it.
            </div>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="mt-4 w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              {isPending ? 'Submitting…' : 'Submit Request'}
            </button>
          </>
        )}
      </div>
    )
  }

  // ── Declined ───────────────────────────────────────────────────────────────
  if (phase === 'declined') {
    return (
      <div className="ef-card rounded-xl p-6">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm dark:bg-red-500/10 dark:border-red-500/30">
          <p className="font-semibold text-red-700 dark:text-red-300">Identity verification failed</p>
          {warningList.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 space-y-0.5 text-xs text-red-700/90 dark:text-red-300/90">
              {warningList.map((w, i) => (
                <li key={i}>{w.short_description ?? w.long_description ?? 'Check failed'}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-red-700/90 dark:text-red-300/90">
              The ID could not be confirmed, or the selfie did not match it.
            </p>
          )}
          <p className="mt-2 text-xs text-red-700/90 dark:text-red-300/90">
            Your request will not reach the Registrar until this passes. Your parent or guardian can try again with
            good lighting and an unexpired ID.
          </p>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleStart}
          disabled={isPending || leaving}
          className="mt-4 w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {leaving ? 'Opening verification…' : isPending ? 'Starting…' : 'Try verification again'}
        </button>
      </div>
    )
  }

  // ── Under manual review ────────────────────────────────────────────────────
  if (phase === 'review') {
    return (
      <div className="ef-card rounded-xl p-6">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
          <p className="font-semibold">Verification under review</p>
          <p className="mt-1 text-xs">
            The check was not conclusive and is being reviewed. No action is needed from you right now.
          </p>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button" onClick={handleRefresh} disabled={isPending}
          className="mt-3 text-xs underline ef-muted disabled:opacity-50"
        >
          {isPending ? 'Checking…' : 'Check for an update'}
        </button>
      </div>
    )
  }

  // ── Started but not finished ───────────────────────────────────────────────
  if (phase === 'pending') {
    return (
      <div className="ef-card rounded-xl p-6">
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-200">
          <p className="font-semibold">Verification in progress</p>
          <p className="mt-1 text-xs">
            The result usually appears within a few seconds of your parent or guardian finishing.
            Your request goes to the Registrar once it passes.
          </p>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-3 flex items-center gap-4">
          {/* The webhook normally updates this on its own. This button is the
              fallback for when it doesn't arrive — it asks Didit directly. */}
          <button
            type="button" onClick={handleRefresh} disabled={isPending}
            className="text-xs underline ef-muted disabled:opacity-50"
          >
            {isPending ? 'Checking…' : 'Check for an update'}
          </button>
          <button
            type="button" onClick={handleStart} disabled={isPending || leaving}
            className="text-xs underline ef-muted disabled:opacity-50"
          >
            Resume verification
          </button>
        </div>
      </div>
    )
  }

  // ── Auto-starting ──────────────────────────────────────────────────────────
  // Straight from the submit form. Showing the full "here's what to expect" card
  // for the split second before we navigate would just flash and vanish.
  if (autoStart && (isPending || leaving) && !error) {
    return (
      <div className="ef-card rounded-xl p-6">
        <p className="text-sm font-semibold" style={{ color: 'var(--card-foreground)' }}>
          Opening parent verification…
        </p>
        <p className="mt-1 text-xs ef-muted">
          Taking you to our verification partner. Your parent or guardian will scan their ID and take a selfie.
        </p>
      </div>
    )
  }

  // ── Not started ────────────────────────────────────────────────────────────
  return (
    <div className="ef-card rounded-xl border-2 border-dashed p-6" style={{ borderColor: 'var(--sti-gold)' }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 w-9 h-9 rounded-full bg-amber-500 text-white text-base font-bold grid place-items-center animate-pulse">
          !
        </div>
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>
            Action Required: Verify Parent/Guardian Identity
          </h3>
          <p className="text-sm ef-muted mt-0.5">
            <strong style={{ color: 'var(--card-foreground)' }}>This request has not been sent to the Registrar yet.</strong>{' '}
            It stays here until your parent or guardian is verified — they need to be{' '}
            <strong style={{ color: 'var(--card-foreground)' }}>with you now</strong> to scan their own valid ID and
            take a short selfie.
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-lg px-3 py-2.5 text-xs ef-muted border ef-border">
        <p className="font-semibold mb-1" style={{ color: 'var(--card-foreground)' }}>What to expect</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>You will be taken to our verification partner, Didit, to complete this securely.</li>
          <li>Your parent scans the front and back of their valid ID, then takes a selfie.</li>
          <li>It takes about 1–2 minutes, and you come straight back here afterwards.</li>
          <li>EXAMFLOW stores only the result — <strong>the ID photo and selfie are not saved to your record</strong>.</li>
        </ul>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={isPending || leaving}
        className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
      >
        {leaving ? 'Opening verification…' : isPending ? 'Starting…' : 'Start parent verification'}
      </button>
    </div>
  )
}
