import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_HOME } from '@/lib/role-home'

// 🔧 Same domain used everywhere else — keep these in sync, or better,
// move this into a single shared constants file later.
const ALLOWED_DOMAIN = process.env.SCHOOL_EMAIL_DOMAIN ?? '@yourschool.edu.ph'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  function fail(message: string) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`)
  }

  if (!code) {
    return fail('Microsoft sign-in was cancelled or failed. Please try again.')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return fail('Could not sign you in with Microsoft. Please try again.')
  }

  const email = (data.user.email ?? '').toLowerCase()

  // Reject any Microsoft account that isn't a school account. The
  // `handle_new_user` trigger already fired and created a profiles row for
  // this user by this point — delete the auth user (cascades to profiles
  // via the FK) so no orphaned account is left behind.
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    await supabase.auth.signOut()
    try {
      const admin = createAdminClient()
      await admin.auth.admin.deleteUser(data.user.id)
    } catch {
      // Even if cleanup fails, still block them from proceeding below.
    }
    return fail(`Please sign in with your school Microsoft account (${ALLOWED_DOMAIN}).`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return fail('This account is inactive. Please contact the registrar.')
  }

  return NextResponse.redirect(`${origin}${ROLE_HOME[profile.role] ?? '/login'}`)
}