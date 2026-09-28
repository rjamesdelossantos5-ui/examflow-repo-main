'use client'

import { useEffect, useState, useTransition } from 'react'
import { signIn, signInWithMicrosoft } from '@/app/login/actions'
import { signUpInline } from '@/app/signup/actions'
import { createClient } from '@/lib/supabase/client'

const NAVY = '#002F6C'
const GOLD = '#FDB913'

type LoginMode = 'student' | 'admin'
type View = 'login' | 'signup'

const COPY: Record<LoginMode, { title: string; subtitle: string }> = {
  student: { title: 'Student Login', subtitle: 'Request and track your special exams.' },
  admin: { title: 'Staff & Admin Login', subtitle: 'Review, approve, and manage requests.' },
}

type Department = { id: string; name: string }

/**
 * Landing-page login/signup popup. Opens when the URL hash is #login (so
 * plain <a href="#login"> triggers anywhere on the page open it) and closes
 * without navigating away. Toggles between Login and Sign Up views in place.
 */
export default function LoginModal() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('login')
  const [loginMode, setLoginMode] = useState<LoginMode>('student')
  const [error, setError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState<'confirm-email' | null>(null)
  const [isPending, startTransition] = useTransition()
  const [departments, setDepartments] = useState<Department[]>([])

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

  useEffect(() => {
    if (view !== 'signup' || departments.length > 0) return
    const supabase = createClient()
    supabase
      .from('departments')
      .select('id, name')
      .order('name')
      .then(({ data, error: deptError }) => {
        if (!deptError && data) setDepartments(data)
      })
  }, [view, departments.length])

  function close() {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setOpen(false)
    resetTransientState()
  }

  function resetTransientState() {
    setError(null)
    setSignupSuccess(null)
  }

  function switchView(next: View) {
    resetTransientState()
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

  function handleSignupSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await signUpInline(fd)
      if (res && 'error' in res) {
        setError(res.error)
      } else if (res && 'needsConfirmation' in res) {
        setSignupSuccess('confirm-email')
      }
    })
  }

  if (!open) return null

  const inputClass =
    'w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/45 bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)] focus:border-transparent transition'
  const labelClass = 'block text-xs font-medium text-blue-100/80 mb-1.5'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="ef-overlay absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} aria-hidden />

      <div
        className="ef-dialog relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #013a85 60%, #024aa6 100%)` }}
        role="dialog"
        aria-modal="true"
      >
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

          {/* ============ LOGIN VIEW ============ */}
          {view === 'login' && (
            <>
              <div className="mt-5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/10">
                {(['student', 'admin'] as LoginMode[]).map((m) => {
                  const active = loginMode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setLoginMode(m)}
                      className="py-2 rounded-lg text-sm font-semibold transition"
                      style={active ? { background: GOLD, color: NAVY } : { color: 'rgba(255,255,255,0.75)' }}
                    >
                      {m === 'student' ? 'Student' : 'Admin & Staff'}
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 mb-5">
                <h2 className="text-xl font-bold text-white">{COPY[loginMode].title}</h2>
                <p className="text-sm text-blue-100/80 mt-0.5">{COPY[loginMode].subtitle}</p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-500/15 border border-red-400/30 px-4 py-2.5 text-sm text-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Email</label>
                  <input name="email" type="email" required autoFocus placeholder="you@examflow.com" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <input name="password" type="password" required placeholder="••••••••" className={inputClass} />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 rounded-xl font-bold text-sm shadow-lg hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60"
                  style={{ background: GOLD, color: NAVY }}
                >
                  {isPending ? 'Signing in…' : `Sign in as ${loginMode === 'student' ? 'Student' : 'Staff'}`}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-white/15" />
                <span className="text-xs text-blue-100/50">or</span>
                <div className="h-px flex-1 bg-white/15" />
              </div>

              {/* Microsoft sign-in — same for both Student and Admin/Staff modes,
                  since auth is identical; only the post-login routing differs. */}
              <form action={signInWithMicrosoft}>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-semibold text-sm bg-white text-gray-800 shadow-lg hover:bg-gray-100 active:scale-[0.99] transition flex items-center justify-center gap-2.5"
                >
                  <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  Continue with Microsoft
                </button>
              </form>

              {loginMode === 'student' && (
                <p className="text-center text-sm text-blue-100/80 mt-4">
                  No account yet?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('signup')}
                    className="font-semibold underline underline-offset-2 hover:text-white transition"
                    style={{ color: GOLD }}
                  >
                    Create a student account
                  </button>
                </p>
              )}

              <p className="text-center text-xs text-blue-100/60 mt-5">
                Trouble signing in? Contact the registrar&apos;s office.
              </p>
            </>
          )}

          {/* ============ SIGN UP VIEW ============ */}
          {view === 'signup' && (
            <>
              <div className="mt-5 mb-5">
                <h2 className="text-xl font-bold text-white">Create a student account</h2>
                <p className="text-sm text-blue-100/80 mt-0.5">Use your official school email address.</p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-500/15 border border-red-400/30 px-4 py-2.5 text-sm text-red-100">
                  {error}
                </div>
              )}

              {signupSuccess === 'confirm-email' ? (
                <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/30 px-4 py-4 text-sm text-emerald-100 space-y-3">
                  <p>
                    Account created! Check your school email inbox for a confirmation
                    link before signing in.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="font-semibold underline underline-offset-2"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <div>
                    <label className={labelClass}>Full Name</label>
                    <input name="fullName" type="text" required autoFocus className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>School Email</label>
                    <input name="email" type="email" required placeholder="you@yourschool.edu.ph" className={inputClass} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Password</label>
                      <input name="password" type="password" required minLength={8} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Confirm Password</label>
                      <input name="confirmPassword" type="password" required minLength={8} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Student Number</label>
                    <input name="studentNumber" type="text" required className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Department</label>
                    <select name="departmentId" required defaultValue="" className={inputClass}>
                      <option value="" disabled className="text-gray-900">Select department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id} className="text-gray-900">
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className={labelClass}>Course</label>
                      <input name="course" type="text" placeholder="e.g. BSIT" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Year</label>
                      <input name="yearLevel" type="number" min={1} max={6} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Section</label>
                    <input name="section" type="text" className={inputClass} />
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full py-3 rounded-xl font-bold text-sm shadow-lg hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60"
                    style={{ background: GOLD, color: NAVY }}
                  >
                    {isPending ? 'Creating account…' : 'Sign Up'}
                  </button>

                  <p className="text-center text-sm text-blue-100/80">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchView('login')}
                      className="font-semibold underline underline-offset-2 hover:text-white transition"
                      style={{ color: GOLD }}
                    >
                      Sign In
                    </button>
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
