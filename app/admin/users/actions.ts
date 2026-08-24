'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, SERVICE_KEY_MISSING } from '@/lib/supabase/admin'
import { IMPORT_CHUNK_SIZE } from './constants'
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

  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_KEY_MISSING }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: friendlyError('deleteUser', error, `We couldn't delete this account. ${RETRY_HINT}`) }

  revalidatePath('/admin/users')
  return { error: null }
}

// ─────────────────────────────────────────────────────────────
// BULK IMPORT
// Mirrors the subject importer: parse the .xlsx in the browser, validate every
// row on the server, show the admin a preview, then write only on confirm.
//
// Creating an auth user is one API call each and cannot be batched, so a
// thousand students would blow the serverless time limit in a single request.
// The client therefore sends SMALL CHUNKS in sequence (see UserUpload.tsx) and
// each call below handles one chunk, which also gives a real progress bar.
// ─────────────────────────────────────────────────────────────

export interface ParsedUserRow {
  full_name: string
  email: string
  role: string
  student_number: string
  course: string
  year_level: string
  section: string
  department_name: string
  password: string
  // resolved during validation:
  department_id?: string | null
  error?: string
}

export async function validateUserRows(rows: ParsedUserRow[]): Promise<ParsedUserRow[]> {
  const supabase = await createClient()
  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me) return rows.map((r) => ({ ...r, error: 'Unauthorized' }))
  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', me.id).single()
  if (myProfile?.role !== 'admin') return rows.map((r) => ({ ...r, error: 'Unauthorized' }))

  // Two lookups total, not two per row.
  const [{ data: depts }, { data: existing }] = await Promise.all([
    supabase.from('departments').select('id, name'),
    supabase.from('profiles').select('email'),
  ])
  const deptMap = new Map((depts ?? []).map((d) => [String(d.name).toLowerCase(), d.id as string]))
  const taken = new Set((existing ?? []).map((p) => String(p.email).toLowerCase()))

  // Duplicates *within the file itself* are caught too — otherwise the first
  // row would import and the second would fail mid-run with a confusing error.
  const seen = new Set<string>()

  return rows.map((row) => {
    const errors: string[] = []
    const email = row.email.toLowerCase()

    if (!row.full_name) errors.push('missing name')
    else if (!isValidName(row.full_name)) errors.push('invalid name')

    if (!email) errors.push('missing email')
    else if (!isValidEmail(email)) errors.push('invalid email')
    else if (taken.has(email)) errors.push('email already registered')
    else if (seen.has(email)) errors.push('duplicate email in file')
    if (email) seen.add(email)

    const role = row.role.toLowerCase().replace(/[\s-]+/g, '_')
    if (!role) errors.push('missing role')
    else if (!ALLOWED_ROLES.includes(role as UserRole)) errors.push(`unknown role "${row.role}"`)

    if (row.password && row.password.length < 6) errors.push('password under 6 characters')
    if (row.student_number && !isValidStudentNumber(row.student_number)) errors.push('invalid student number')
    if (row.course && !isValidCode(row.course)) errors.push('invalid course')
    if (row.section && !isValidCode(row.section)) errors.push('invalid section')

    let department_id: string | null = null
    if (row.department_name) {
      department_id = deptMap.get(row.department_name.toLowerCase()) ?? null
      if (!department_id) errors.push(`unknown department "${row.department_name}"`)
    }

    return { ...row, email, role, department_id, error: errors.length ? errors.join('; ') : undefined }
  })
}

export async function importUserChunk(
  rows: ParsedUserRow[],
  fallbackPassword: string,
): Promise<{ error: string | null; created: number; failures: { email: string; reason: string }[] }> {
  const supabase = await createClient()
  const { data: { user: me } } = await supabase.auth.getUser()
  if (!me) return { error: 'Unauthorized', created: 0, failures: [] }
  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', me.id).single()
  if (myProfile?.role !== 'admin') return { error: 'Unauthorized', created: 0, failures: [] }

  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_KEY_MISSING, created: 0, failures: [] }

  if (rows.length > IMPORT_CHUNK_SIZE) {
    return { error: 'Chunk too large', created: 0, failures: [] }
  }

  let created = 0
  const failures: { email: string; reason: string }[] = []

  for (const row of rows) {
    if (row.error) {
      failures.push({ email: row.email, reason: row.error })
      continue
    }
    const password = row.password || fallbackPassword
    if (!password || password.length < 6) {
      failures.push({ email: row.email, reason: 'no password (set a default or add a Password column)' })
      continue
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: row.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: row.full_name, role: row.role },
    })
    if (authError || !authData.user) {
      failures.push({ email: row.email, reason: authError?.message ?? 'account creation failed' })
      continue
    }

    // handle_new_user() already inserted a bare profile from the trigger, so
    // this fills in the details it couldn't know. Upsert, not insert.
    const yearNum = row.year_level ? Number(row.year_level) : null
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: row.full_name,
      email: row.email,
      role: row.role as UserRole,
      department_id: row.department_id ?? null,
      student_number: row.student_number || null,
      course: row.course || null,
      year_level: Number.isInteger(yearNum) && yearNum! >= 1 && yearNum! <= 6 ? yearNum : null,
      section: row.section || null,
      is_active: true,
    })
    if (profileError) {
      // The login exists but its details didn't save — say so plainly rather
      // than reporting success for a half-made account.
      failures.push({ email: row.email, reason: 'account created but profile details failed to save' })
      continue
    }
    created++
  }

  revalidatePath('/admin/users')
  return { error: null, created, failures }
}
