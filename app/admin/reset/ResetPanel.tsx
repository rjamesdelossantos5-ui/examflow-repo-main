'use client'

import { useCallback, useState, useTransition } from 'react'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { getResetPreview, resetRequests, getSchoolDataPreview, clearUnusedAccounts, clearSchoolStructure } from './actions'

/** Which reset the open dialog is for. */
type Mode = 'requests' | 'school'

interface Preview {
  requests: number
  /** null = the count query failed. Shown as unknown, never as zero. */
  files: number | null
  // Only for 'school':
  accounts?: number
  subjects?: number
  classes?: number
  departments?: number
  programs?: number
}

interface Done {
  message: string
  fileWarning: string | null
}

/** Typed to arm the button. Long enough that it can't be muscle memory, short
 *  enough to type without resentment. Different per reset, so one can't be
 *  confirmed by habit from the other. */
const CONFIRM_WORD: Record<Mode, string> = { requests: 'RESET', school: 'CLEAR' }

// The loop of account batches stops here even if the server keeps reporting
// more — a guard against a runaway loop, far above any real class size.
const MAX_ACCOUNT_ROUNDS = 200

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

/**
 * Two TESTING tools, not school workflows:
 *  - Delete all requests: so a demo run can start clean without waiting for
 *    real submission windows and exam dates to pass. Everything else stays.
 *  - Clear school data: also removes what the School Data import made, so a
 *    different file can be imported from nothing.
 * They live on Admin, away from the day-to-day queues, behind a live count and
 * a typed confirmation, because nothing they do can be undone.
 */
export default function ResetPanel() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [isPending, startTransition] = useTransition()

  // Stable callback so the listener isn't rebound on every render — same
  // pattern as the Program Head's dialogs.
  const close = useCallback(() => setMode(null), [])
  useEscapeKey(close, !!mode && !isPending)

  function openDialog(m: Mode) {
    setError(null)
    setPreview(null)
    setTyped('')
    setLoading(true)
    setMode(m)
    // Counts are fetched when the dialog opens, not when the page rendered, so
    // the admin confirms against what is in the database right now.
    startTransition(async () => {
      const res = m === 'requests' ? await getResetPreview() : await getSchoolDataPreview()
      setLoading(false)
      if (res.error) { setError(res.error); return }
      setPreview(res.preview)
    })
  }

  function confirm() {
    if (!mode) return
    const m = mode
    setError(null)
    startTransition(async () => {
      setProgress('Deleting requests and files…')
      const res = await resetRequests()
      if (res.error) { setProgress(null); setError(res.error); return }
      const requestsLine = `${plural(res.deletedRequests ?? 0, 'request')} and ${plural(res.filesRemoved ?? 0, 'file')}`

      if (m === 'requests') {
        setProgress(null)
        setMode(null)
        setDone({ message: `Deleted ${requestsLine}.`, fileWarning: res.fileWarning ?? null })
        return
      }

      let accounts = 0
      for (let round = 0; round < MAX_ACCOUNT_ROUNDS; round++) {
        setProgress(`Deleting accounts — ${accounts} so far…`)
        const a = await clearUnusedAccounts()
        if (a.error) { setProgress(null); setError(a.error); return }
        accounts += a.deleted
        if (a.remaining === 0) break
      }

      setProgress('Deleting subjects, classes, programs and departments…')
      const s = await clearSchoolStructure()
      setProgress(null)
      if (s.error) { setError(s.error); return }
      setMode(null)
      setDone({
        message: `Deleted ${plural(accounts, 'account')}, ${requestsLine}, and every subject, class, program and department. Import a School Data file to start again.`,
        fileWarning: res.fileWarning ?? null,
      })
    })
  }

  const armed = !!mode && typed.trim().toUpperCase() === CONFIRM_WORD[mode] && !!preview && !isPending

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Reset test data</h2>
        <p className="text-sm ef-muted">
          Start a test or demo run from nothing. Pick how much to remove.
        </p>
      </div>

      {done && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">
          <p className="font-semibold">{done.message}</p>
          {done.fileWarning && (
            <p className="mt-1 text-xs">
              Some files could not be removed from storage ({done.fileWarning}). The records are gone, so this is leftover clutter in the bucket — not broken data.
            </p>
          )}
        </div>
      )}

      {error && !mode && (
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
          onClick={() => openDialog('requests')}
          className="px-6 py-2.5 rounded-lg font-semibold text-sm text-white"
          style={{ backgroundColor: 'var(--status-danger)' }}
        >
          Reset test data…
        </button>
      </div>

      <div className="ef-card rounded-xl shadow-sm p-6 space-y-4 border-2" style={{ borderColor: 'var(--status-danger)' }}>
        <div>
          <h3 className="font-bold" style={{ color: 'var(--card-foreground)' }}>Clear school data</h3>
          <p className="text-sm ef-muted mt-1">
            Removes everything the School Data import made, so you can import a different file from nothing: every
            subject, class, program and department, every account that has never signed in, and all requests.
          </p>
        </div>

        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--status-danger) 10%, transparent)', color: 'var(--card-foreground)' }}>
          <p className="font-semibold">This cannot be undone.</p>
          <p className="mt-1 text-xs">
            Kept: admins, every account that has signed in at least once (your team keeps its Microsoft login — the
            next import gives them their role again), your exam periods and settings. A test account made with
            “+ Add User” is removed too unless it has signed in once.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openDialog('school')}
          className="px-6 py-2.5 rounded-lg font-semibold text-sm text-white"
          style={{ backgroundColor: 'var(--status-danger)' }}
        >
          Clear school data…
        </button>
      </div>

      {mode && (
        <div className="ef-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={isPending ? undefined : close}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="reset-title" className="ef-dialog ef-card rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 id="reset-title" className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>
              {mode === 'requests' ? 'Delete all requests?' : 'Clear all school data?'}
            </h3>

            {loading && <p className="mt-3 text-sm ef-muted">Checking what is there…</p>}

            {error && (
              <p className="mt-3 rounded-md px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">{error}</p>
            )}

            {preview && (
              <>
                <div className="mt-3 space-y-2 text-sm">
                  {mode === 'requests' ? (
                    preview.requests === 0 ? (
                      <p className="ef-muted">There are no requests to delete. Nothing will change.</p>
                    ) : (
                      <p className="ef-muted">
                        This deletes{' '}
                        <strong style={{ color: 'var(--card-foreground)' }}>{plural(preview.requests, 'request')}</strong>
                        {preview.files === null
                          ? ' and their uploaded files'
                          : <> and <strong style={{ color: 'var(--card-foreground)' }}>{plural(preview.files, 'file')}</strong></>}
                        {' '}permanently.
                      </p>
                    )
                  ) : (
                    <>
                      <p className="ef-muted">This permanently deletes:</p>
                      <ul className="list-disc pl-5 space-y-0.5" style={{ color: 'var(--card-foreground)' }}>
                        <li><strong>{plural(preview.accounts ?? 0, 'account')}</strong> that never signed in</li>
                        <li><strong>{plural(preview.subjects ?? 0, 'subject')}</strong> and <strong>{plural(preview.classes ?? 0, 'class', 'classes')}</strong></li>
                        <li><strong>{plural(preview.programs ?? 0, 'program')}</strong> and <strong>{plural(preview.departments ?? 0, 'department')}</strong></li>
                        <li>
                          <strong>{plural(preview.requests, 'request')}</strong>
                          {preview.files === null ? ' and their files' : <> and <strong>{plural(preview.files, 'file')}</strong></>}
                        </li>
                      </ul>
                    </>
                  )}
                  <p className="ef-muted text-xs">
                    {mode === 'requests'
                      ? 'Accounts, subjects and exam periods are not touched.'
                      : 'Admins, accounts that have signed in, and exam periods are kept.'}
                  </p>
                </div>

                <label className="block mt-4">
                  <span className="text-xs ef-muted">Type <strong style={{ color: 'var(--card-foreground)' }}>{CONFIRM_WORD[mode]}</strong> to confirm</span>
                  <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    disabled={isPending}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--status-danger)]"
                    style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
                  />
                </label>
              </>
            )}

            {progress && <p className="mt-3 text-sm ef-muted" aria-live="polite">{progress}</p>}

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={close} disabled={isPending} className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border disabled:opacity-50" style={{ color: 'var(--card-foreground)' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!armed}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--status-danger)' }}
              >
                {isPending && !loading ? 'Deleting…' : 'Delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
