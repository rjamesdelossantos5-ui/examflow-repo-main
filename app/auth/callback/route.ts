import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_HOME } from '@/lib/role-home'

// 🔧 Same domain used everywhere else in the app.
const ALLOWED_DOMAIN = process.env.SCHOOL_EMAIL_DOMAIN ?? '@yourschool.edu.ph'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const cookieStore = await cookies()

  // Cookie mutations from the Supabase client are captured here and applied
  // directly to whichever response we actually return at the end. Relying on
  // them auto-attaching to a separately-constructed NextResponse.redirect()
  // was the bug — this makes it explicit instead.
  let pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies = cookiesToSet
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // fine to ignore here; the values below on the response are what matter
            }
          })
        },
      },
    }
  )

  function respond(location: string) {
    const res = NextResponse.redirect(`${origin}${location}`)
    pendingCookies.forEach(({ name, value, options }) => {
      res.cookies.set(name, value, options as never)
    })
    return res
  }

  if (!code) {
    return respond('/login?error=' + encodeURIComponent('Microsoft sign-in was cancelled or failed. Please try again.'))
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return respond('/login?error=' + encodeURIComponent('Could not sign you in with Microsoft. Please try again.'))
  }

  const email = (data.user.email ?? '').toLowerCase()

  // Reject any Microsoft account that isn't a school account.
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    await supabase.auth.signOut()
    try {
      const admin = createAdminClient()
      await admin.auth.admin.deleteUser(data.user.id)
    } catch {
      // Even if cleanup fails, still block them from proceeding below.
    }
    return respond(
      '/login?error=' + encodeURIComponent(`Please sign in with your school Microsoft account (${ALLOWED_DOMAIN}).`)
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return respond('/login?error=' + encodeURIComponent('This account is inactive. Please contact the registrar.'))
  }

  return respond(ROLE_HOME[profile.role] ?? '/login')
}