'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/lib/role-home'

// The address the person is actually on — localhost, a phone on the same Wi-Fi,
// a Vercel preview or the live site — so Microsoft sends them back there. A fixed
// fallback of localhost sent every phone and every live-site login to a machine
// that isn't running EXAMFLOW. Server Actions already abort when the Origin
// header doesn't match the Host, so Origin is the page's own address. Supabase
// still only returns to addresses listed under Authentication → URL
// Configuration → Redirect URLs.
async function siteOrigin(): Promise<string> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function login(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return redirect('/login?error=Server+is+not+configured.+Supabase+environment+variables+are+missing.')
  }

  const supabase = await createClient()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return redirect('/login?error=Please+fill+in+all+fields')
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return redirect('/login?error=Invalid+email+or+password')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return redirect('/login?error=Account+is+inactive')
  }

  const cookieStore = await cookies()
  cookieStore.delete('ef_banner_dismissed')
  cookieStore.delete('ef_modal_seen')

  revalidatePath('/', 'layout')
  redirect(ROLE_HOME[profile.role] ?? '/login')
}

// Inline variant for the landing-page popup: returns the error string (so the
// modal can show it in place) instead of redirecting to /login on failure. On
// success it still redirects to the role's dashboard.
export async function signIn(formData: FormData): Promise<{ error: string } | void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { error: 'Server is not configured. Supabase environment variables are missing.' }
  }

  const supabase = await createClient()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) return { error: 'Please fill in all fields.' }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { error: 'Invalid email or password.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return { error: 'Your account is inactive. Please contact the registrar.' }
  }

  const cookieStore = await cookies()
  cookieStore.delete('ef_banner_dismissed')
  cookieStore.delete('ef_modal_seen')

  revalidatePath('/', 'layout')
  redirect(ROLE_HOME[profile.role] ?? '/login')
}

// Starts the Microsoft OAuth flow using Supabase's built-in Azure provider,
// configured as multi-tenant + personal accounts on the Entra side. Redirects
// the browser to Microsoft's sign-in page; account creation/domain validation
// happens back in app/auth/callback/route.ts once Microsoft redirects here.
export async function signInWithMicrosoft() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback`,
      // email: without it, Azure won't return the user's email.
      // profile: without it, Azure sends no name, so the account's name was
      // its email address (see the name swap in app/auth/callback/route.ts).
      scopes: 'email profile',
    },
  })

  if (error || !data?.url) {
    return redirect('/login?error=' + encodeURIComponent('Could not start Microsoft sign-in. Please try again.'))
  }

  redirect(data.url)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  // Straight to the landing page's login popup.
  redirect('/?login=1')
}