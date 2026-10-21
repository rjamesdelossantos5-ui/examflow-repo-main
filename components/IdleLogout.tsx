'use client'

import { useEffect } from 'react'
import { idleLogout } from '@/app/login/actions'
import { ACTIVE_COOKIE, IDLE_MS } from '@/lib/sessionCookie'
import { toastError } from '@/components/Toaster'

/**
 * Signs the person out after IDLE_MS (15 minutes) without activity. Renders
 * nothing. Mounted once in DashboardLayout, so it covers every role.
 *
 * "Activity" is a mouse move, click, key press, scroll or touch. The time of the
 * last one is kept in ACTIVE_COOKIE, not in memory, so every open tab shares it
 * and proxy.ts can enforce the same limit on the server (it signs out a request
 * that arrives after the limit, which also covers a phone whose page timers were
 * paused while the browser was in the background).
 */
const WRITE_EVERY_MS = 15_000   // don't rewrite the cookie on every mouse move
const CHECK_EVERY_MS = 15_000
const WARN_BEFORE_MS = 2 * 60 * 1000

function readLastActive(): number {
  const match = document.cookie.split('; ').find((c) => c.startsWith(ACTIVE_COOKIE + '='))
  const n = match ? Number(match.slice(ACTIVE_COOKIE.length + 1)) : NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

function writeLastActive(at: number) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${ACTIVE_COOKIE}=${at}; Path=/; SameSite=Lax${secure}`
}

export default function IdleLogout() {
  useEffect(() => {
    let lastWrite = 0
    let warned = false
    let leaving = false

    function markActive() {
      const now = Date.now()
      if (now - lastWrite < WRITE_EVERY_MS) return
      lastWrite = now
      warned = false
      writeLastActive(now)
    }

    function check() {
      if (leaving) return
      const last = readLastActive()
      if (!last) { markActive(); return }
      const idle = Date.now() - last
      if (idle >= IDLE_MS) {
        leaving = true
        void idleLogout()
      } else if (!warned && idle >= IDLE_MS - WARN_BEFORE_MS) {
        warned = true
        toastError('You will be signed out in 2 minutes because of inactivity. Move the mouse or press a key to stay signed in.')
      }
    }

    // A page opened after the limit has already passed (a restored tab, a phone
    // coming back) is checked before anything counts as activity.
    check()
    if (!leaving) markActive()

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }))
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive))
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
