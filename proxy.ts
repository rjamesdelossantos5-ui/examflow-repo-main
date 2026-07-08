import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  registrar: '/registrar',
  subject_teacher: '/teacher',
  program_head: '/program-head',
  student: '/student',
}

export async function proxy(request: NextRequest) {
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
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

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
