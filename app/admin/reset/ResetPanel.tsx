'use client'

import { useCallback, useState, useTransition } from 'react'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { getResetPreview, resetRequests } from './actions'

interface Preview {
  requests: number
  /** null = the count query failed. Shown as unknown, never as zero. */
  files: number | null
}

interface Done {
  deletedRequests: number
  filesRemoved: number
  fileWarning: string | null
}

/** Typed to arm the button. Long enough that it can't be muscle memory, short
 *  enough to type without resentment. */
const CONFIRM_WORD = 'RESET'

/**
 * Deletes every special exam request in the system.
 *
 * This is a TESTING tool, not a school workflow — it exists so a demo run can
 * start clean instead of waiting for real submission windows and exam dates to
 * pass. It lives on Admin, away from the day-to-day queues, and behind both a
 * live count and a typed confirmation, because nothing it does can be undone.
 */
export default function ResetPanel() {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [isPending, startTransition] = useTransition()

  // Stable callback so the listener isn't rebound on every render — same
  // pattern as the Program Head's dialogs.
  const close = useCallback(() => setOpen(false), [])
  useEscapeKey(close, open)

  function openDialog() {
    setError(null)
    setPreview(null)
    setTyped('')
    setLoading(true)
    setOpen(true)
    // Counts are fetched when the dialog opens, not when the page rendered, so
    // the admin confirms against what is in the database right now.
    startTransition(async () => {
      const res = await getResetPreview()
      setLoading(false)
      if (res.error) { setError(res.error); return }
      setPreview(res.preview)
    })
  }

  function confirm() {
    setError(null)
    startTransition(async () => {
      const res = await resetRequests()
      if (res.error) { setError(res.error); return }
      setOpen(false)
      setDone({
        deletedRequests: res.deletedRequests ?? 0,
        filesRemoved: res.filesRemoved ?? 0,
        fileWarning: res.fileWarning ?? null,
      })
    })
  }

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD && !!preview && !isPending

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Reset test data</h2>
        <p className="text-sm ef-muted">
          Clears every special exam request so a test or demo run can start from nothing.
        </p>
      </div>

      {done && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">
          <p className="font-semibold">
            Deleted {done.deletedRequests} request{done.deletedRequests === 1 ? '' : 's'} and {done.filesRemoved} file{done.filesRemoved === 1 ? '' : 's'}.
          </p>
          {done.fileWarning && (
            <p className="mt-1 text-xs">
              Some files could not be removed from storage ({done.fileWarning}). The records are gone, so this is leftover clutter in the bucket — not broken data.
            </p>
          )}
        </div>
      )}

      {error && !open && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="ef-card rounded-xl shadow-sm p-6 space-y-4 border-2" style={{ borderColor: 'var(--status-danger)' }}>
        <div>
          <h3 className="font-bold" style={{ color: 'var(--card-foreground)' }}>Delete all requests</h3>
          <p className="text-sm ef-muted mt-1">
            Removes every request, its activity log, and every file uploaded with it — receipts, signatures and supporting documents.
          </p>
        </div>

        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--status-danger) 10%, transparent)', color: 'var(--card-foreground)' }}>
          <p className="font-semibold">This cannot be undone.</p>
          <p className="mt-1 text-xs">
            Student, teacher and staff accounts, subjects, departments, the class schedule and your exam periods are all kept — only the requests go, so you can submit again straight away.
          </p>
        </div>

        <button
          type="button"
          onClick={openDialog}
          className="px-6 py-2.5 rounded-lg font-semibold text-sm text-white"
          style={{ backgroundColor: 'var(--status-danger)' }}
        >
          Reset test data…
        </button>
      </div>

      {open && (
        <div className="ef-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={close}>
          <div className="ef-dialog ef-card rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>Delete everything?</h3>

            {loading && <p className="mt-3 text-sm ef-muted">Checking what is there…</p>}

            {error && (
              <p className="mt-3 rounded-md px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">{error}</p>
            )}

            {preview && (
              <>
                <div className="mt-3 space-y-2 text-sm">
                  {preview.requests === 0 ? (
                    <p className="ef-muted">There are no requests to delete. Nothing will change.</p>
                  ) : (
                    <p className="ef-muted">
                      This deletes{' '}
                      <strong style={{ color: 'var(--card-foreground)' }}>
                        {preview.requests} request{preview.requests === 1 ? '' : 's'}
                      </strong>
                      {preview.files === null
                        ? ' and their uploaded files'
                        : <> and <strong style={{ color: 'var(--card-foreground)' }}>{preview.files} file{preview.files === 1 ? '' : 's'}</strong></>}
                      {' '}permanently.
                    </p>
                  )}
                  <p className="ef-muted text-xs">Accounts, subjects and exam periods are not touched.</p>
                </div>

                <label className="block mt-4">
                  <span className="text-xs ef-muted">Type <strong style={{ color: 'var(--card-foreground)' }}>{CONFIRM_WORD}</strong> to confirm</span>
                  <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--status-danger)]"
                    style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
                  />
                </label>
              </>
            )}

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={close} className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border" style={{ color: 'var(--card-foreground)' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!armed}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--status-danger)' }}
              >
                {isPending ? 'Deleting…' : 'Delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
