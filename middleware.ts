import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Supabase access tokens expire (~1 hour) and refresh tokens are single-use —
// each refresh must persist a new one back to the browser. Server Components
// can't write cookies (see lib/supabase/server.ts), so without this
// middleware every refresh attempt during a normal page load gets silently
// discarded. The next refresh then tries to reuse an already-spent refresh
// token, fails, and every page's `if (!user) redirect('/login')` guard kicks
// in — which looks exactly like being logged out for no reason after some
// time using the site. This middleware runs on every request specifically to
// keep that refresh cycle alive and actually save it.
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

  // Do not remove — this is what actually triggers the refresh-and-persist
  // cycle above. Without calling it, setAll above never runs on an expired
  // token and this middleware does nothing.
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
