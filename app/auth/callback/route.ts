import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_HOME } from '@/lib/role-home'
import { recordLogin } from '@/lib/loginHistory'
import { asSessionCookie } from '@/lib/sessionCookie'
import { withoutAccountTag } from '@/lib/initials'

// Student AND teacher accounts both use this domain (@stamaria.sti.edu.ph).
const ALLOWED_DOMAIN = process.env.SCHOOL_EMAIL_DOMAIN ?? '@stamaria.sti.edu.ph'
// Program Head accounts use this domain (@stamaria.sti.edu).
// endsWith on the "@…" form keeps the two apart: the .edu.ph domain does not end
// with the .edu one.
const PROGRAM_HEAD_DOMAIN = process.env.FACULTY_EMAIL_DOMAIN ?? '@stamaria.sti.edu'

// Inside ALLOWED_DOMAIN, the part before the @ tells student and teacher apart:
//   student -> has a number   (juan.123456@stamaria.sti.edu.ph)
//   teacher -> has no number  (maria.santos@stamaria.sti.edu.ph)
function looksLikeStudentEmail(email: string) {
  const localPart = email.split('@')[0] ?? ''
  return /\d/.test(localPart)
}

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
              cookieStore.set(name, value, asSessionCookie(value, options))
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
      res.cookies.set(name, value, asSessionCookie(value, options) as never)
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

  const isProgramHeadEmail = email.endsWith(PROGRAM_HEAD_DOMAIN)
  const isSchoolEmail = email.endsWith(ALLOWED_DOMAIN) // student or teacher
  const isStudentEmail = isSchoolEmail && looksLikeStudentEmail(email)
  const isTeacherEmail = isSchoolEmail && !isStudentEmail

  // Condition 1: reject any Microsoft account that isn't a school account.
  if (!isSchoolEmail && !isProgramHeadEmail) {
    await supabase.auth.signOut()
    try {
      const admin = createAdminClient()
      await admin?.auth.admin.deleteUser(data.user.id)
    } catch {
      // Even if cleanup fails, still block them from proceeding below.
    }
    return respond(
      '/login?error=' + encodeURIComponent(`Please sign in with your school Microsoft account (${ALLOWED_DOMAIN} or ${PROGRAM_HEAD_DOMAIN}).`)
    )
  }

  // Condition 2: the account must have an active profile.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, full_name')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return respond('/login?error=' + encodeURIComponent('This account is inactive. Please contact the registrar.'))
  }

  // New accounts are always created as 'student' (handle_new_user, see
  // migration_role_escalation.sql). The email decides what a bare student
  // account becomes:
  //   @stamaria.sti.edu                      -> Program Head
  //   @stamaria.sti.edu.ph, no number        -> Subject Teacher
  //   @stamaria.sti.edu.ph, with a number    -> stays Student
  // Accounts that already have a staff role are left alone (never demoted).
  // Service role: a database guard stops everyone but an admin changing a role.
  let role = profile.role
  let newRole: string | null = null
  if (role === 'student') {
    if (isProgramHeadEmail) newRole = 'program_head'
    else if (isTeacherEmail) newRole = 'subject_teacher'
  }

  if (newRole) {
    const admin = createAdminClient()
    const { error: roleError } = admin
      ? await admin.from('profiles').update({ role: newRole }).eq('id', data.user.id)
      : { error: new Error('SUPABASE_SERVICE_ROLE_KEY is not configured') }
    if (roleError) {
      console.error('[auth/callback] role update failed', roleError)
      await supabase.auth.signOut()
      return respond('/login?error=' + encodeURIComponent('Your account could not be set up. Please contact the admin.'))
    }
    role = newRole
  }

  // Accounts created before the login asked Microsoft for `profile` got their
  // email (or the part before the @) as their name. Swap in the name Microsoft
  // sends — Supabase refreshes user_metadata on every sign-in — but never
  // overwrite a name the person typed themselves. Best effort: a failed update
  // must not block the sign-in.
  //
  // School Microsoft accounts are named "Surname, Given (Student)": the bracketed
  // tag is Microsoft's, not part of the name, so it is dropped from what is saved.
  // Removing only that tag is safe for a name the person typed, so it is also
  // removed from an already-saved name (new accounts arrive with it from
  // handle_new_user, which copies Microsoft's name as is).
  const msName = withoutAccountTag(String(data.user.user_metadata?.full_name ?? '').trim().slice(0, 200))
  const stored = String(profile.full_name ?? '').trim()
  const isPlaceholder = stored.toLowerCase() === email || stored.toLowerCase() === email.split('@')[0]
  const nextName = isPlaceholder ? msName : withoutAccountTag(stored)
  if (nextName && nextName !== stored) {
    // Service role: a database guard stops users changing their own full_name.
    // The row is the one just authenticated above.
    const admin = createAdminClient()
    if (admin) {
      const { error: nameError } = await admin.from('profiles').update({ full_name: nextName }).eq('id', data.user.id)
      if (nameError) console.error('[auth/callback] name update failed', nameError)
    }
  }

  await recordLogin(supabase, 'microsoft')

  return respond(ROLE_HOME[role] ?? '/login')
}