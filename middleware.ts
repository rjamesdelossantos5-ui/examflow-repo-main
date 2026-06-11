import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  registrar: '/registrar',
  subject_teacher: '/teacher',
  program_head: '/program-head',
  student: '/student',
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
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
      // Redirect logged-in users to their dashboard
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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
