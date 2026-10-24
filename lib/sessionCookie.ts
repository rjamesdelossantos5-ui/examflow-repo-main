// Session lifetime rules, shared by the server, the proxy, the Microsoft
// callback and the browser.
//
// 1. A login that does not outlive the browser. @supabase/ssr writes its cookies
//    with maxAge = 400 days, whatever cookieOptions say, so closing the browser
//    did not sign anyone out. Every place that writes those cookies passes the
//    options through asSessionCookie() to drop the lifetime: the cookie then
//    ends when the browser closes. A removal (empty value, maxAge 0) is left
//    alone, so signing out still deletes the cookie.
//
// 2. Sign out after IDLE_MS without activity. The page records its last activity
//    in the ACTIVE_COOKIE (see components/IdleLogout.tsx); proxy.ts rejects the
//    session once that timestamp is older than IDLE_MS, so it also holds when a
//    phone browser is left open or its timers were paused.

/** Longest a signed-in person may be inactive. */
export const IDLE_MS = 60 * 60 * 1000

/** Cookie holding the time of the person's last activity (ms since epoch). */
export const ACTIVE_COOKIE = 'ef-active'

type CookieOptions = Record<string, unknown> | undefined

export function asSessionCookie<T extends CookieOptions>(value: string, options: T): T {
  if (!value || !options) return options
  const rest: Record<string, unknown> = { ...options }
  delete rest.maxAge
  delete rest.expires
  return rest as T
}
