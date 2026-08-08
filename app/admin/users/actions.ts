'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isValidEmail, isValidName, isValidStudentNumber, isValidCode } from '@/lib/validation'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'
import type { UserRole } from '@/lib/supabase/types'

const ALLOWED_ROLES: UserRole[] = ['admin', 'registrar', 'subject_teacher', 'program_head', 'student']

function sanitize(v: unknown): string {
  return String(v ?? '').trim().slice(0, 500)
}

export async function createUser(formData: FormData) {
  const supabase = await createClient()

  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me) return { error: 'Unauthorized' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', me.id).single()
  if (myProfile?.role !== 'admin') return { error: 'Unauthorized' }

  const fullName = sanitize(formData.get('full_name'))
  const email = sanitize(formData.get('email')).toLowerCase()
  const password = sanitize(formData.get('password'))
  const role = sanitize(formData.get('role')) as UserRole
  const departmentId = sanitize(formData.get('department_id')) || null
  const studentNumber = sanitize(formData.get('student_number')) || null
  const course = sanitize(formData.get('course')) || null
  const yearLevel = formData.get('year_level') ? Number(formData.get('year_level')) : null
  const section = sanitize(formData.get('section')) || null

  if (!fullName || !email || !password || !ALLOWED_ROLES.includes(role)) {
    return { error: 'Missing or invalid fields' }
  }
  if (!isValidName(fullName)) return { error: 'Enter a valid full name (letters only).' }
  if (!isValidEmail(email)) return { error: 'Enter a valid email address.' }
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' }
  if (studentNumber && !isValidStudentNumber(studentNumber)) return { error: 'Enter a valid student number (digits only, e.g. 2024-00001).' }
  if (course && !isValidCode(course)) return { error: 'Enter a valid course (letters and numbers only).' }
  if (section && !isValidCode(section)) return { error: 'Enter a valid section (letters and numbers only).' }

  // Create auth user via admin API — requires service role key on server
  // We use the standard signUp as a workaround; in production use supabase admin client
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  })

  if (authError || !authData.user) {
    // Supabase Auth messages here are written for humans ("a user with this
    // email is already registered", "password too short") and the admin needs
    // that detail to fix the form — unlike Postgres errors, they expose no
    // schema. So we surface it, but still log the full error for debugging.
    console.error('[createUser.auth]', authError)
    return { error: authError?.message ?? `We couldn't create this account. ${RETRY_HINT}` }
  }

  // Upsert profile with extra fields
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: authData.user.id,
    full_name: fullName,
    email,
    role,
    department_id: departmentId,
    student_number: studentNumber,
    course,
    year_level: yearLevel,
    section,
    is_active: true,
  })

  if (profileError) return { error: friendlyError('createUser.profile', profileError, `The account was created but we couldn't save its profile details. ${RETRY_HINT}`) }

  revalidatePath('/admin/users')
  return { error: null }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const supabase = await createClient()

  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me) return { error: 'Unauthorized' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', me.id).single()
  if (myProfile?.role !== 'admin') return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)

  if (error) return { error: friendlyError('toggleUserActive', error, `We couldn't update this account's status. ${RETRY_HINT}`) }
  revalidatePath('/admin/users')
  return { error: null }
}

export async function toggleOverride(userId: string, canOverride: boolean) {
  const supabase = await createClient()

  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me) return { error: 'Unauthorized' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', me.id).single()
  if (myProfile?.role !== 'admin') return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('profiles')
    .update({ can_override: canOverride })
    .eq('id', userId)

  if (error) return { error: friendlyError('toggleOverride', error, `We couldn't update override permission. ${RETRY_HINT}`) }
  revalidatePath('/admin/users')
  return { error: null }
}

export async function deleteUser(userId: string) {
  const supabase = await createClient()

  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me) return { error: 'Unauthorized' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', me.id).single()
  if (myProfile?.role !== 'admin') return { error: 'Unauthorized' }

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return { error: friendlyError('deleteUser', error, `We couldn't delete this account. ${RETRY_HINT}`) }

  revalidatePath('/admin/users')
  return { error: null }
}
