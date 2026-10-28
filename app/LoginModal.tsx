'use client'

import { useEffect, useState, useTransition } from 'react'
import { signIn, signInWithMicrosoft } from '@/app/login/actions'
import { STI } from '@/lib/brand'

// Same paper-and-ink palette as the landing page. Colours are inline (not
// bg-white / border / text-gray-* classes) because the dashboard dark-mode
// overrides in globals.css retarget those classes; this popup always renders light.
const NAVY = STI.navy
const BLUE = STI.blue
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
  // Seconds left before another login attempt is allowed. Set after a failed
  // attempt so rapid repeat submits don't re-trigger Supabase's auth rate limit.
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    // /login redirects here with ?login=1 (and ?error=… when something went
    // wrong). Open the popup, show the error in it, then drop both from the
    // address bar so the page's URL is just "/".
    const params = new URLSearchParams(window.location.search)
    const fromRedirect = params.get('login') === '1' || params.has('error')
    const openFromRedirect = () => {
      setOpen(true)
      setError(params.get('error'))
      history.replaceState(null, '', window.location.pathname)
    }
    if (fromRedirect) openFromRedirect()

    const sync = () => setOpen(window.location.hash === '#login')
    if (!fromRedirect) sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

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
    if (cooldown > 0) return
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await signIn(fd)
      if (res?.error) {
        setError(res.error)
        setCooldown(5)
      }
    })
  }

  if (!open) return null

  const inputClass =
    'w-full rounded-[4px] px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#047EAF] focus:ring-offset-1 transition-shadow'
  const inputStyle = { background: '#FFFFFF', color: NAVY, border: `1px solid ${RULE}` }
  const labelClass = 'block text-sm font-semibold mb-1.5'
  const primaryClass =
    'ef-press w-full py-3 rounded-[4px] text-base font-bold transition-opacity hover:opacity-90 disabled:opacity-60'
  const secondaryClass =
    'ef-press w-full py-3 rounded-[4px] text-base font-semibold transition-colors hover:bg-[#F2F5FA]'

  return (
    // Pinned near the top (not vertically centred), so the popup opens where
    // the eye already is: at the header's Log in button.
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-14 pb-4">
      <div className="ef-overlay absolute inset-0" style={{ background: 'rgba(0, 18, 46, 0.6)' }} onClick={close} aria-hidden />

      <div
        className="ef-dialog no-scrollbar relative w-full max-w-[26rem] rounded-[6px] max-h-[90vh] overflow-y-auto"
        style={{ background: '#FFFFFF', color: NAVY, boxShadow: '0 24px 48px -16px rgba(0, 12, 34, 0.5)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${RULE}` }}>
          <h2 id="login-title" className="text-xl font-extrabold">
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
                style={{ background: BLUE, color: '#FFFFFF' }}
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
                <button type="submit" disabled={isPending || cooldown > 0} className={primaryClass} style={{ background: BLUE, color: '#FFFFFF' }}>
                  {isPending ? 'Logging in…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Log in'}
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
