'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, SERVICE_KEY_MISSING } from '@/lib/supabase/admin'
import { testToolsEnabled } from '@/lib/testTools'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'

// Testing tools only (see lib/testTools.ts). Every action checks both the
// admin role and the ENABLE_TEST_TOOLS switch, so they do nothing on a real
// deployment even if called directly.
async function requireTestAdmin() {
  if (!testToolsEnabled()) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return null
  return supabase
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── 1. Mock enrollment list ─────────────────────────────────────────────────

/** Replaces the whole mock enrollment list. Rows whose section isn't in the class schedule are skipped. */
export async function saveTestEnrollments(rows: { email: string; section: string }[]) {
  const supabase = await requireTestAdmin()
  if (!supabase) return { error: 'Unauthorized', saved: 0, skipped: [] as { row: number; reason: string }[] }

  const { data: offered } = await supabase.from('class_offerings').select('section')
  const sections = new Set((offered ?? []).map((o) => String(o.section).toUpperCase()))

  const skipped: { row: number; reason: string }[] = []
  const good = new Map<string, string>()
  rows.slice(0, 2000).forEach((r, i) => {
    const email = String(r.email ?? '').trim().toLowerCase()
    const section = String(r.section ?? '').trim().toUpperCase()
    if (!EMAIL.test(email)) return skipped.push({ row: i + 2, reason: `not an email address: "${r.email}"` })
    if (!sections.has(section)) return skipped.push({ row: i + 2, reason: `section "${r.section}" is not in the class schedule` })
    good.set(email, section)
  })

  const { error: delErr } = await supabase.from('test_enrollments').delete().not('email', 'is', null)
  if (delErr) return { error: friendlyError('saveTestEnrollments.clear', delErr, `We couldn't replace the list. ${RETRY_HINT}`), saved: 0, skipped }
  if (good.size) {
    const { error } = await supabase.from('test_enrollments').insert([...good].map(([email, section]) => ({ email, section })))
    if (error) return { error: friendlyError('saveTestEnrollments', error, `We couldn't save the list. ${RETRY_HINT}`), saved: 0, skipped }
  }

  revalidatePath('/admin/testing')
  revalidatePath('/student/submit')
  return { error: null, saved: good.size, skipped }
}

// ── 2. Test teacher accounts ────────────────────────────────────────────────

const slug = (alias: string) => alias.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** "casano.340503@school" + "santos-m" → "casano.340503+test-santos-m@school" (any existing +tag is replaced). */
function plusAddress(inbox: string, tag: string): string {
  const [local, domain] = inbox.split('@')
  return `${local.split('+')[0]}+test-${tag}@${domain}`
}

/**
 * For the chosen sections, creates one test teacher account per instructor in
 * the schedule and points those sections' classes at it. Every account's
 * email is a +address of one real inbox, so all teacher notifications land
 * there. Real teacher matches are not changed: only the class rows for these
 * sections are re-pointed, and Clean up restores them.
 */
export async function generateTestTeachers(input: { sections: string[]; inbox: string; password: string }) {
  const supabase = await requireTestAdmin()
  if (!supabase) return { error: 'Unauthorized', teachers: [] as { name: string; email: string; classes: number; reused: boolean }[] }
  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_KEY_MISSING, teachers: [] }

  const inbox = String(input.inbox ?? '').trim().toLowerCase()
  const password = String(input.password ?? '')
  const sections = [...new Set((input.sections ?? []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))].slice(0, 50)
  if (!EMAIL.test(inbox)) return { error: 'Enter the group inbox as a full email address.', teachers: [] }
  if (password.length < 8) return { error: 'The test password must be at least 8 characters.', teachers: [] }
  if (!sections.length) return { error: 'Choose at least one section.', teachers: [] }

  const { data: classes, error: readErr } = await supabase
    .from('class_offerings')
    .select('id, instructor, subjects(department_id)')
    .in('section', sections)
  if (readErr) return { error: friendlyError('generateTestTeachers.read', readErr, `We couldn't read those sections. ${RETRY_HINT}`), teachers: [] }

  const byAlias = new Map<string, { ids: string[]; department: string | null }>()
  for (const c of classes ?? []) {
    const alias = String(c.instructor ?? '').trim()
    if (!alias) continue
    const entry = byAlias.get(alias) ?? { ids: [], department: (c.subjects as unknown as { department_id: string | null } | null)?.department_id ?? null }
    entry.ids.push(c.id as string)
    byAlias.set(alias, entry)
  }
  if (!byAlias.size) return { error: 'Those sections have no instructors in the class schedule. Import the schedule first.', teachers: [] }

  const made: { name: string; email: string; classes: number; reused: boolean }[] = []
  for (const [alias, { ids, department }] of byAlias) {
    const email = plusAddress(inbox, slug(alias))
    const name = `TEST – ${alias}`

    // Re-running for the same inbox reuses the account instead of failing on a duplicate email.
    const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
    let id = existing?.id as string | undefined
    if (!id) {
      const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } })
      if (error || !created.user) return { error: `Could not create ${name}: ${error?.message ?? 'unknown error'}`, teachers: made }
      id = created.user.id
      const { error: tagErr } = await supabase.from('test_accounts').insert({ user_id: id })
      if (tagErr) return { error: friendlyError('generateTestTeachers.tag', tagErr, `Created ${name} but could not mark it as a test account. ${RETRY_HINT}`), teachers: made }
    }

    // New accounts start as students (handle_new_user); make this one a teacher.
    const { error: profErr } = await supabase.from('profiles').upsert({
      id, full_name: name, email, role: 'subject_teacher', department_id: department, is_active: true,
    })
    if (profErr) return { error: friendlyError('generateTestTeachers.profile', profErr, `Could not set up ${name}. ${RETRY_HINT}`), teachers: made }

    const { error: linkErr } = await supabase.from('class_offerings').update({ teacher_id: id }).in('id', ids)
    if (linkErr) return { error: friendlyError('generateTestTeachers.link', linkErr, `Could not link ${name} to its classes. ${RETRY_HINT}`), teachers: made }

    made.push({ name, email, classes: ids.length, reused: !!existing })
  }

  revalidatePath('/admin/testing')
  revalidatePath('/admin/schedule')
  return { error: null, teachers: made }
}

// ── 3. Clean up ─────────────────────────────────────────────────────────────

/**
 * Removes the mock enrollment list and every account the test-teacher tool
 * made, then re-links those classes to the real teachers the admin matched on
 * the Class Schedule page. An account that already acted on a request can't
 * be deleted while that history exists — Reset Test Data clears it first.
 */
export async function cleanUpTestData() {
  const supabase = await requireTestAdmin()
  if (!supabase) return { error: 'Unauthorized' }
  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_KEY_MISSING }

  const { error: enrErr } = await supabase.from('test_enrollments').delete().not('email', 'is', null)
  if (enrErr) return { error: friendlyError('cleanUpTestData.enrollments', enrErr, `We couldn't clear the enrollment list. ${RETRY_HINT}`) }

  const { data: accounts } = await supabase.from('test_accounts').select('user_id')
  let deleted = 0
  let kept = 0
  for (const a of accounts ?? []) {
    const { error } = await admin.auth.admin.deleteUser(a.user_id as string)
    if (error) kept++
    else deleted++
  }

  // Classes left without a teacher go back to the real match, where one exists.
  const [{ data: aliases }, { data: orphans }] = await Promise.all([
    supabase.from('instructor_aliases').select('alias, teacher_id'),
    supabase.from('class_offerings').select('id, instructor').is('teacher_id', null),
  ])
  const realTeacher = new Map((aliases ?? []).map((a) => [a.alias as string, a.teacher_id as string]))
  let relinked = 0
  for (const [teacher, ids] of groupBy(orphans ?? [], (o) => realTeacher.get(String(o.instructor ?? '')))) {
    if (!teacher) continue
    const { error } = await supabase.from('class_offerings').update({ teacher_id: teacher }).in('id', ids)
    if (!error) relinked += ids.length
  }

  revalidatePath('/admin/testing')
  revalidatePath('/admin/schedule')
  return { error: null, deleted, kept, relinked }
}

function groupBy<T extends { id: unknown }>(rows: T[], key: (r: T) => string | undefined): Map<string | undefined, string[]> {
  const m = new Map<string | undefined, string[]>()
  for (const r of rows) {
    const k = key(r)
    m.set(k, [...(m.get(k) ?? []), r.id as string])
  }
  return m
}
