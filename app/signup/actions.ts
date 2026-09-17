'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// 🔧 Set this to your school's actual email domain.
const ALLOWED_DOMAIN = process.env.SCHOOL_EMAIL_DOMAIN ?? '@yourschool.edu.ph'

type ValidatedFields = {
  fullName: string
  email: string
  password: string
  studentNumber: string
  course: string
  yearLevel: number | null
  section: string
  departmentId: string
}

type ValidationResult =
  | { ok: false; error: string }
  | { ok: true; fields: ValidatedFields }

function validateSignupFields(formData: FormData): ValidationResult {
  const fullName = String(formData.get('fullName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')
  const studentNumber = String(formData.get('studentNumber') ?? '').trim()
  const course = String(formData.get('course') ?? '').trim()
  const yearLevelRaw = String(formData.get('yearLevel') ?? '').trim()
  const section = String(formData.get('section') ?? '').trim()
  const departmentId = String(formData.get('departmentId') ?? '').trim()

  if (!fullName || !email || !password || !confirmPassword || !studentNumber || !departmentId) {
    return { ok: false, error: 'Please fill in all required fields.' }
  }
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return { ok: false, error: `Please use your school email address (${ALLOWED_DOMAIN}).` }
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  if (password !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' }
  }

  const yearLevel = yearLevelRaw ? Number(yearLevelRaw) : null
  if (yearLevelRaw && (yearLevel === null || Number.isNaN(yearLevel) || yearLevel < 1 || yearLevel > 6)) {
    return { ok: false, error: 'Year level must be a number between 1 and 6.' }
  }

  return {
    ok: true,
    fields: { fullName, email, password, studentNumber, course, yearLevel, section, departmentId },
  }
}

// --- Form-based variant (full page /signup, progressive enhancement) ---
export async function signup(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return redirect('/signup?error=' + encodeURIComponent('Server is not configured.'))
  }

  const result = validateSignupFields(formData)
  if (!result.ok) {
    return redirect(`/signup?error=${encodeURIComponent(result.error)}`)
  }

  const supabase = await createClient()
  const { fullName, email, password, studentNumber, course, yearLevel, section, departmentId } = result.fields

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        student_number: studentNumber,
        course: course || null,
        year_level: yearLevel,
        section: section || null,
        department_id: departmentId,
      },
    },
  })

  if (error) return redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  if (!data.user) return redirect(`/signup?error=${encodeURIComponent('Something went wrong. Please try again.')}`)

  if (!data.session) redirect('/signup/check-email')
  redirect('/student')
}

// --- Modal-friendly variant (used by the landing-page popup) ---
// Returns an object instead of redirecting on error/pending-confirmation,
// so the client component can show the message in place without navigating.
export async function signUpInline(
  formData: FormData
): Promise<{ error: string } | { needsConfirmation: true } | void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { error: 'Server is not configured. Supabase environment variables are missing.' }
  }

  const result = validateSignupFields(formData)
  if (!result.ok) return { error: result.error }

  const supabase = await createClient()
  const { fullName, email, password, studentNumber, course, yearLevel, section, departmentId } = result.fields

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        student_number: studentNumber,
        course: course || null,
        year_level: yearLevel,
        section: section || null,
        department_id: departmentId,
      },
    },
  })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'Something went wrong creating your account. Please try again.' }

  if (!data.session) {
    return { needsConfirmation: true }
  }

  // Already confirmed/logged in (email confirmation disabled): send them in.
  redirect('/student')
}