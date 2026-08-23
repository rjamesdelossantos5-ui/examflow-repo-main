'use client'

import { useCallback, useState, useTransition } from 'react'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { deleteRequest } from './actions'

export default function DeleteRequestButton({ requestId, label = 'Withdraw this request' }: { requestId: string; label?: string }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const closeConfirm = useCallback(() => setConfirming(false), [])
  useEscapeKey(closeConfirm, confirming)

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteRequest(requestId)
      // On success the action redirects; only an error returns here
      if (res?.error) {
        setError(res.error)
        setConfirming(false)
      }
    })
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}
      <button
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
      >
        {label}
      </button>

      {confirming && (
        <div className="ef-overlay fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirming(false)}>
          <div className="ef-dialog ef-card rounded-xl shadow-xl max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>Remove this request?</h3>
            <p className="text-sm ef-muted mt-1 mb-5">
              This permanently deletes the request and its uploaded documents. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border"
                style={{ color: 'var(--card-foreground)' }}
              >
                Keep It
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-red-600 text-white disabled:opacity-60"
              >
                {isPending ? 'Withdrawing…' : 'Yes, Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
