'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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

// ── 2. Clean up ─────────────────────────────────────────────────────────────

/** Deletes the mock enrollment list. Test requests are removed with Reset Test Data. */
export async function cleanUpTestData() {
  const supabase = await requireTestAdmin()
  if (!supabase) return { error: 'Unauthorized', removed: 0 }

  const { data, error } = await supabase.from('test_enrollments').delete().not('email', 'is', null).select('email')
  if (error) return { error: friendlyError('cleanUpTestData', error, `We couldn't clear the enrollment list. ${RETRY_HINT}`), removed: 0 }

  revalidatePath('/admin/testing')
  revalidatePath('/student/submit')
  return { error: null, removed: data?.length ?? 0 }
}
