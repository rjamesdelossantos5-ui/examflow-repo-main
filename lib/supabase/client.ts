'use client'

import { createBrowserClient } from '@supabase/ssr'

// Supabase client for the BROWSER side (Client Components: realtime
// subscriptions, storage uploads, client-side queries). Uses the public anon
// key — actual data access is enforced by RLS policies, not by this key.
// Server Components / Server Actions must use lib/supabase/server.ts instead.
//
// The browser client rewrites the session cookie whenever it refreshes a token.
// By default it gives that cookie a 400-day lifetime, which would undo the
// "signed out when the browser closes" rule (lib/sessionCookie.ts). So cookies
// are read and written here directly, without a lifetime. A removal (empty
// value) still deletes the cookie.
function readCookies() {
  if (typeof document === 'undefined' || !document.cookie) return []
  return document.cookie.split('; ').map((pair) => {
    const i = pair.indexOf('=')
    const name = i === -1 ? pair : pair.slice(0, i)
    const raw = i === -1 ? '' : pair.slice(i + 1)
    let value = raw
    try { value = decodeURIComponent(raw) } catch { /* keep the raw value */ }
    return { name, value }
  })
}

function writeCookie(name: string, value: string, options: Record<string, unknown> = {}) {
  if (typeof document === 'undefined') return
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${(options.path as string) ?? '/'}`]
  const sameSite = (options.sameSite as string | undefined) ?? 'lax'
  parts.push(`SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`)
  if (options.domain) parts.push(`Domain=${options.domain as string}`)
  if (!value) parts.push('Max-Age=0')
  if (location.protocol === 'https:') parts.push('Secure')
  document.cookie = parts.join('; ')
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => readCookies(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => writeCookie(name, value, options as Record<string, unknown>))
        },
      },
    },
  )
}
