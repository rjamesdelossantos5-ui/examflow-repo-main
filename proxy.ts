import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ACTIVE_COOKIE, IDLE_MS, asSessionCookie } from '@/lib/sessionCookie'

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  registrar: '/registrar/dashboard',
  subject_teacher: '/teacher/dashboard',
  program_head: '/program-head/dashboard',
  student: '/student',
}

export async function proxy(request: NextRequest) {
  // Inbound webhooks — must run BEFORE anything else here.
  //
  // A webhook is a server-to-server POST from another company. It carries no
  // Supabase session cookie, so `user` below is null and it would fall into the
  // "Protected routes" branch and be redirected to /login. The sender sees a
  // 307, the route handler never runs, and the result is lost silently — no
  // error in the logs, nothing to debug, just requests that never get verified.
  //
  // These routes authenticate the SENDER instead, by HMAC signature over the
  // raw body (see app/api/webhooks/didit/route.ts). Cookie auth is meaningless
  // here, so it is skipped entirely rather than worked around.
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next({ request })
  }

  // Bail out early if env vars are not configured yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { pathname } = request.nextUrl
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.next({ request })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // When Supabase refreshes the session it hands us new cookies. They must
        // be written to BOTH the request (so this same pass sees the fresh token)
        // and a freshly-rebuilt response (so the browser receives the Set-Cookie).
        // Skipping either side silently logs users out mid-session. Do not edit
        // this without reading the Supabase SSR middleware guide.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, asSessionCookie(value, options))
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Inactivity limit (see lib/sessionCookie.ts). The page keeps ACTIVE_COOKIE
  // up to date while the person is using it. A signed-in request whose last
  // activity is older than IDLE_MS is signed out here, which also covers a phone
  // browser that was left open or whose page timers were paused. With no cookie
  // yet (just signed in) it starts now; with nobody signed in a leftover one is
  // cleared so the next sign-in starts fresh.
  const lastActive = Number(request.cookies.get(ACTIVE_COOKIE)?.value)
  if (!user) {
    if (request.cookies.has(ACTIVE_COOKIE)) supabaseResponse.cookies.delete(ACTIVE_COOKIE)
  } else if (Number.isFinite(lastActive) && lastActive > 0 && Date.now() - lastActive > IDLE_MS) {
    await supabase.auth.signOut()
    const res = NextResponse.redirect(
      new URL('/login?error=' + encodeURIComponent('You were signed out after 1 hour of inactivity. Please sign in again.'), request.url),
    )
    // The sign-out's cookie removals live on supabaseResponse; carry them over.
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c))
    res.cookies.delete(ACTIVE_COOKIE)
    return res
  } else if (!request.cookies.has(ACTIVE_COOKIE)) {
    supabaseResponse.cookies.set(ACTIVE_COOKIE, String(Date.now()), { path: '/', sameSite: 'lax' })
  }

  // Fully public and never redirected away from: a person must be able to read
  // what will be collected BEFORE signing in, and a signed-in student opening it
  // from the submit form must not be bounced to their dashboard mid-form.
  if (pathname === '/privacy') {
    return supabaseResponse
  }

  // Microsoft sign-in lands here BEFORE there is a session — this route is what
  // creates it (and runs the school-domain check). Treating it as protected
  // bounced every Microsoft login to /login with the code thrown away.
  if (pathname === '/auth/callback') {
    return supabaseResponse
  }

  // Public routes that don't need auth
  if (pathname === '/login' || pathname === '/') {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) {
        const home = ROLE_HOME[profile.role] ?? '/login'
        return NextResponse.redirect(new URL(home, request.url))
      }
    }
    return supabaseResponse
  }

  // Protected routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based access control
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = profile.role

  const routeRules: { prefix: string; allowed: string[] }[] = [
    { prefix: '/admin', allowed: ['admin'] },
    { prefix: '/registrar', allowed: ['registrar', 'admin'] },
    { prefix: '/teacher', allowed: ['subject_teacher', 'admin'] },
    { prefix: '/program-head', allowed: ['program_head', 'admin'] },
    { prefix: '/student', allowed: ['student'] },
  ]

  for (const rule of routeRules) {
    if (pathname.startsWith(rule.prefix)) {
      if (!rule.allowed.includes(role)) {
        const home = ROLE_HOME[role] ?? '/login'
        return NextResponse.redirect(new URL(home, request.url))
      }
      break
    }
  }

  return supabaseResponse
}

export const config = {
  // Run on every route EXCEPT Next.js internals and static image assets — those
  // don't need auth and skipping them avoids a DB round-trip per static file.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
