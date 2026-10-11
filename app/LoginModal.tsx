'use client'

import { useEffect, useState, useTransition } from 'react'
import { signIn, signInWithMicrosoft } from '@/app/login/actions'

// Same paper-and-ink palette as the landing page. Colours are inline (not
// bg-white / border / text-gray-* classes) because the dashboard dark-mode
// overrides in globals.css retarget those classes; this popup always renders light.
const NAVY = '#002F6C'
const RULE = '#D5DCE6'

// choose: Microsoft or staff · staff: email + password
type View = 'choose' | 'staff'

/**
 * Landing-page login popup. Opens when the URL hash is #login (so plain
 * <a href="#login"> anywhere on the page opens it) and closes without
 * navigating away. Two buttons only: Microsoft, or the email/password staff
 * login.
 */
export default function LoginModal() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('choose')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const sync = () => setOpen(window.location.hash === '#login')
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setOpen(false)
    setView('choose')
    setError(null)
  }

  function switchView(next: View) {
    setError(null)
    setView(next)
  }

  function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await signIn(fd)
      if (res?.error) setError(res.error)
    })
  }

  if (!open) return null

  const inputClass =
    'w-full rounded-[4px] px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#002F6C] focus:ring-offset-1 transition-shadow'
  const inputStyle = { background: '#FFFFFF', color: NAVY, border: `1px solid ${RULE}` }
  const labelClass = 'block text-sm font-semibold mb-1.5'
  const primaryClass =
    'ef-press w-full py-3 rounded-[4px] text-base font-bold transition-opacity hover:opacity-90 disabled:opacity-60'
  const secondaryClass =
    'ef-press w-full py-3 rounded-[4px] text-base font-semibold transition-colors hover:bg-[#F2F5FA]'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="ef-overlay absolute inset-0" style={{ background: 'rgba(0, 18, 46, 0.6)' }} onClick={close} aria-hidden />

      <div
        className="ef-dialog no-scrollbar relative w-full max-w-[26rem] rounded-[6px] max-h-[90vh] overflow-y-auto"
        style={{ background: '#FFFFFF', color: NAVY, boxShadow: '0 24px 48px -16px rgba(0, 12, 34, 0.5)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${RULE}` }}>
          <h2 id="login-title" className="text-xl font-extrabold" style={{ fontStretch: '115%' }}>
            {view === 'staff' ? 'Staff log in' : 'Log in'}
          </h2>
          <button
            onClick={close}
            className="w-9 h-9 -mr-2 grid place-items-center rounded-[4px] transition-colors hover:bg-[#F2F5FA]"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <p role="alert" className="mb-4 rounded-[4px] px-3.5 py-2.5 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
              {error}
            </p>
          )}

          {/* ============ CHOOSE ============ */}
          {view === 'choose' && (
            <div className="space-y-3">
              <form action={signInWithMicrosoft}>
                <button
                  type="submit"
                  className={`${secondaryClass} flex items-center justify-center gap-3`}
                  style={{ background: '#FFFFFF', color: NAVY, border: `1.5px solid ${NAVY}` }}
                >
                  {/* Official Microsoft logo: four squares, Microsoft's brand colours */}
                  <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                  </svg>
                  Log in with Microsoft
                </button>
              </form>

              <button
                type="button"
                onClick={() => switchView('staff')}
                className={primaryClass}
                style={{ background: NAVY, color: '#FFFFFF' }}
              >
                Staff log in
              </button>
            </div>
          )}

          {/* ============ STAFF: email + password ============ */}
          {view === 'staff' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className={labelClass}>Email</label>
                <input id="login-email" name="email" type="email" required autoFocus autoComplete="username" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label htmlFor="login-password" className={labelClass}>Password</label>
                <input id="login-password" name="password" type="password" required autoComplete="current-password" className={inputClass} style={inputStyle} />
              </div>

              <div className="pt-2 space-y-3">
                <button type="submit" disabled={isPending} className={primaryClass} style={{ background: NAVY, color: '#FFFFFF' }}>
                  {isPending ? 'Logging in…' : 'Log in'}
                </button>
                <button
                  type="button"
                  onClick={() => switchView('choose')}
                  className={secondaryClass}
                  style={{ background: '#FFFFFF', color: NAVY, border: `1px solid ${RULE}` }}
                >
                  Back
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
