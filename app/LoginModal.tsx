'use client'

import { useEffect, useState, useTransition } from 'react'
import { signIn } from '@/app/login/actions'

const NAVY = '#002F6C'
const GOLD = '#FDB913'

type Mode = 'student' | 'admin'

const COPY: Record<Mode, { title: string; subtitle: string }> = {
  student: { title: 'Student Login', subtitle: 'Request and track your special exams.' },
  admin: { title: 'Staff & Admin Login', subtitle: 'Review, approve, and manage requests.' },
}

/**
 * Landing-page login popup. Opens when the URL hash is #login (so plain
 * <a href="#login"> triggers anywhere on the page open it) and closes without
 * navigating away. The Student / Admin toggle is presentational — auth is the
 * same for everyone and the server routes each user to their own dashboard.
 */
export default function LoginModal() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('student')
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
    // Drop the #login hash without jumping the scroll position.
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setOpen(false)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await signIn(fd)
      if (res?.error) setError(res.error) // success redirects server-side
    })
  }

  if (!open) return null

  const inputClass =
    'w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/45 bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)] focus:border-transparent transition'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="ef-overlay absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} aria-hidden />

      <div
        className="ef-dialog relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #013a85 60%, #024aa6 100%)` }}
        role="dialog"
        aria-modal="true"
      >
        {/* glow accents */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: GOLD }} />

        <div className="relative p-7">
          <button
            onClick={close}
            className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="font-black text-2xl tracking-tight text-white mb-1">
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </div>

          {/* Student / Admin selector */}
          <div className="mt-5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/10">
            {(['student', 'admin'] as Mode[]).map((m) => {
              const active = mode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="py-2 rounded-lg text-sm font-semibold transition"
                  style={active ? { background: GOLD, color: NAVY } : { color: 'rgba(255,255,255,0.75)' }}
                >
                  {m === 'student' ? 'Student' : 'Admin & Staff'}
                </button>
              )
            })}
          </div>

          <div className="mt-5 mb-5">
            <h2 className="text-xl font-bold text-white">{COPY[mode].title}</h2>
            <p className="text-sm text-blue-100/80 mt-0.5">{COPY[mode].subtitle}</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/15 border border-red-400/30 px-4 py-2.5 text-sm text-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-blue-100/80 mb-1.5">Email</label>
              <input name="email" type="email" required autoFocus placeholder="you@examflow.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-100/80 mb-1.5">Password</label>
              <input name="password" type="password" required placeholder="••••••••" className={inputClass} />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl font-bold text-sm shadow-lg hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60"
              style={{ background: GOLD, color: NAVY }}
            >
              {isPending ? 'Signing in…' : `Sign in as ${mode === 'student' ? 'Student' : 'Staff'}`}
            </button>
          </form>

          <p className="text-center text-xs text-blue-100/60 mt-5">
            Trouble signing in? Contact the registrar&apos;s office.
          </p>
        </div>
      </div>
    </div>
  )
}
