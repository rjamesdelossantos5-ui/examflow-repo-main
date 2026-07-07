'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  registrar: '/registrar',
  subject_teacher: '/teacher',
  program_head: '/program-head',
  student: '/student',
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

  // A dismissed dashboard banner/popup should reappear on every fresh login.
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

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
