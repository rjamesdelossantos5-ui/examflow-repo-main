'use client'

import { useCallback, useState, useTransition } from 'react'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { getEndTermPreview, endTerm } from '../actions'

/** Queue-facing labels for the statuses endTerm() auto-rejects. Keep in step
 *  with UNRESOLVED_STATUSES in ../actions.ts. */
const STATUS_LABEL: Record<string, string> = {
  submitted: 'waiting on the Registrar',
  verified_by_registrar: 'waiting on a Subject Teacher',
  approved_by_teacher: 'waiting on you',
  receipt_uploaded: 'paid — waiting on you to confirm the receipt',
}

interface Preview {
  termLabel: string
  total: number
  byStatus: Record<string, number>
  paidAwaitingConfirmation: number
}

/**
 * Ends the active term.
 *
 * Rendered outside SettingsForm rather than inside it: that component is one
 * large <form>, and a destructive action nested in it would either submit the
 * form or need defensive event handling for no benefit.
 *
 * Deliberately a two-step flow. The counts are fetched from the server when the
 * dialog opens, so the Program Head is confirming against what is actually in
 * the queues right now — not a number rendered when the page loaded.
 */
export default function EndTerm({ activeTermLabel }: { activeTermLabel: string | null }) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  // Stable callback so the listener isn't rebound on every render — same
  // pattern as SettingsForm's dialogs.
  const close = useCallback(() => setOpen(false), [])
  useEscapeKey(close, open)

  function openDialog() {
    setError(null)
    setPreview(null)
    setLoading(true)
    setOpen(true)
    startTransition(async () => {
      const res = await getEndTermPreview()
      setLoading(false)
      if (res.error) { setError(res.error); return }
      setPreview(res.preview)
    })
  }

  function confirm() {
    setError(null)
    startTransition(async () => {
      const res = await endTerm()
      if (res.error) { setError(res.error); return }
      setOpen(false)
      setDone(res.rejectedCount ?? 0)
    })
  }

  if (done !== null) {
    return (
      <div className="max-w-lg">
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">
          <p className="font-semibold">Term ended.</p>
          <p className="mt-1 text-xs">
            {done === 0
              ? 'Nothing was pending, so no requests were rejected.'
              : `${done} pending request${done === 1 ? '' : 's'} ${done === 1 ? 'was' : 'were'} closed with a reason students can see.`}{' '}
            Students can no longer submit. Set a new submission window above to start the next term.
          </p>
        </div>
      </div>
    )
  }

  if (!activeTermLabel) {
    return (
      <div className="max-w-lg border-t ef-border pt-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>End Term</h2>
        <p className="text-sm ef-muted mt-1">
          No term is active right now, so there is nothing to end. Set a submission window above to start one.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg border-t ef-border pt-6">
      <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>End Term</h2>
      <p className="text-sm ef-muted mt-1">
        Closes <strong style={{ color: 'var(--foreground)' }}>{activeTermLabel}</strong>. Students can no longer submit,
        and the staff queues clear. Nothing is deleted — every request, document and history entry is kept, and students
        keep seeing their own.
      </p>

      {error && !open && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={openDialog}
        disabled={isPending}
        className="mt-4 px-4 py-2.5 rounded-lg font-semibold text-sm border disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        style={{ borderColor: '#ef4444', color: '#ef4444' }}
      >
        End {activeTermLabel}…
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="End term"
        >
          <div className="ef-card rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>
              End {preview?.termLabel ?? activeTermLabel}?
            </h3>

            {loading && <p className="mt-3 text-sm ef-muted">Checking what is still pending…</p>}

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                {error}
              </div>
            )}

            {preview && !loading && (
              <div className="mt-3 space-y-3 text-sm">
                {preview.total === 0 ? (
                  <p className="ef-muted">Nothing is pending review. The term will simply close.</p>
                ) : (
                  <>
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
                      <p className="font-semibold">
                        {preview.total} request{preview.total === 1 ? '' : 's'} will be rejected
                      </p>
                      <ul className="mt-1.5 list-disc pl-4 text-xs space-y-0.5">
                        {Object.entries(preview.byStatus).map(([status, n]) => (
                          <li key={status}>{n} {STATUS_LABEL[status] ?? status}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs">
                        Each will show the reason: “The term ended before this request could be reviewed.”
                      </p>
                    </div>

                    {/* Called out on its own. These students have already paid —
                        the most consequential thing this button does, and the
                        easiest to miss inside a single total. */}
                    {preview.paidAwaitingConfirmation > 0 && (
                      <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                        <p className="font-semibold text-xs">
                          ⚠️ {preview.paidAwaitingConfirmation} of these already paid and uploaded a receipt.
                        </p>
                        <p className="mt-1 text-xs">
                          Rejecting them does not refund anything. Consider confirming those receipts first.
                        </p>
                      </div>
                    )}
                  </>
                )}

                <p className="ef-muted text-xs">
                  Requests already accepted or scheduled are not touched. Nothing is deleted, and you can start the
                  next term whenever you are ready.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border"
                style={{ color: 'var(--card-foreground)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={isPending || loading || !preview}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-50"
                style={{ backgroundColor: '#ef4444' }}
              >
                {isPending ? 'Ending…' : 'Yes, end the term'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
