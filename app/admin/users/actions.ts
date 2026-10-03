'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, SERVICE_KEY_MISSING } from '@/lib/supabase/admin'
import { isValidEmail, isValidName, isValidStudentNumber, isValidCode } from '@/lib/validation'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'
import type { UserRole } from '@/lib/supabase/types'

const ALLOWED_ROLES: UserRole[] = ['admin', 'registrar', 'subject_teacher', 'program_head', 'student']

function sanitize(v: unknown): string {
  return String(v ?? '').trim().slice(0, 500)
}

/**
 * The profile fields shared by Create and Edit. Only the fields the role uses
 * are kept (the form shows just those): a department for teachers and Program
 * Heads, student details for students, nothing extra for registrars and admins.
 */
function readProfileFields(formData: FormData) {
  const fullName = sanitize(formData.get('full_name'))
  const role = sanitize(formData.get('role')) as UserRole
  const isStudent = role === 'student'
  const departmentId = role === 'subject_teacher' || role === 'program_head' ? sanitize(formData.get('department_id')) || null : null
  const studentNumber = isStudent ? sanitize(formData.get('student_number')) || null : null
  const course = isStudent ? sanitize(formData.get('course')) || null : null
  const yearLevel = isStudent && formData.get('year_level') ? Number(formData.get('year_level')) : null
  const section = isStudent ? sanitize(formData.get('section')) || null : null

  const fail = (error: string) => ({ error, fullName, role, departmentId, studentNumber, course, yearLevel, section })
  if (!fullName || !ALLOWED_ROLES.includes(role)) return fail('Missing or invalid fields')
  if (role === 'program_head' && !departmentId) return fail('A Program Head needs a department — it decides which requests they review.')
  if (!isValidName(fullName)) return fail('Enter a valid full name (letters only).')
  if (studentNumber && !isValidStudentNumber(studentNumber)) return fail('Enter a valid student number (digits only, e.g. 2024-00001).')
  if (course && !isValidCode(course)) return fail('Enter a valid course (letters and numbers only).')
  if (section && !isValidCode(section)) return fail('Enter a valid section (letters and numbers only).')
  if (yearLevel !== null && !(Number.isInteger(yearLevel) && yearLevel >= 1 && yearLevel <= 6)) return fail('Year level must be 1 to 6.')
  return { error: null, fullName, role, departmentId, studentNumber, course, yearLevel, section }
}

export async function createUser(formData: FormData) {
  const supabase = await createClient()

  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me) return { error: 'Unauthorized' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', me.id).single()
  if (myProfile?.role !== 'admin') return { error: 'Unauthorized' }

  const email = sanitize(formData.get('email')).toLowerCase()
  const password = sanitize(formData.get('password'))
  const fields = readProfileFields(formData)
  if (fields.error !== null) return { error: fields.error }
  const { fullName, role, departmentId, studentNumber, course, yearLevel, section } = fields

  if (!email || !password) return { error: 'Missing or invalid fields' }
  if (!isValidEmail(email)) return { error: 'Enter a valid email address.' }
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' }

  // auth.admin.* requires the SERVICE ROLE key — the anon key gets 403 "User
  // not allowed". This used to call it on the anon client, so account creation
  // could never have worked. The admin client is created only after the caller
  // has been confirmed to be an admin above.
  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_KEY_MISSING }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
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

/**
 * Edits an existing account's name, role and the details that role uses. The
 * email is not editable: it is also the login, and changing only the profile
 * copy is how the login and profile emails drifted apart before.
 */
export async function updateUser(userId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me) return { error: 'Unauthorized' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', me.id).single()
  if (myProfile?.role !== 'admin') return { error: 'Unauthorized' }

  const fields = readProfileFields(formData)
  if (fields.error !== null) return { error: fields.error }
  const { fullName, role, departmentId, studentNumber, course, yearLevel, section } = fields
  // Changing your own role would lock you out of this page.
  if (userId === me.id && role !== 'admin') return { error: "You can't remove your own admin role." }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, role, department_id: departmentId, student_number: studentNumber, course, year_level: yearLevel, section })
    .eq('id', userId)
    .select('id')

  if (error) return { error: friendlyError('updateUser', error, `We couldn't save these changes. ${RETRY_HINT}`) }
  if (!updated?.length) return { error: 'This account no longer exists.' }

  revalidatePath('/admin/users')
  revalidatePath('/admin/subjects')
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

export async function deleteUser(userId: string) {
  const supabase = await createClient()

  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me) return { error: 'Unauthorized' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', me.id).single()
  if (myProfile?.role !== 'admin') return { error: 'Unauthorized' }

  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_KEY_MISSING }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: friendlyError('deleteUser', error, `We couldn't delete this account. ${RETRY_HINT}`) }

  revalidatePath('/admin/users')
  return { error: null }
}
