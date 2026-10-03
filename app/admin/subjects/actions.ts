'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isValidCode } from '@/lib/validation'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return null
  return supabase
}

/**
 * Edits a subject's code and name, and who teaches it in each section.
 * `teachers` maps a class (class_offerings id) to a teacher's id, or '' for no
 * teacher. Only this subject's classes and only Subject Teachers are accepted.
 * Requests already submitted keep the teacher they were sent to.
 */
export async function updateSubject(input: { subjectId: string; code: string; name: string; teachers: Record<string, string> }) {
  const supabase = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const code = String(input.code ?? '').trim().toUpperCase().slice(0, 40)
  const name = String(input.name ?? '').trim().slice(0, 300)
  if (!code || !isValidCode(code)) return { error: 'Enter a valid subject code (letters and numbers only).' }
  if (!name) return { error: 'Enter the subject name.' }

  const { data: updated, error } = await supabase
    .from('subjects')
    .update({ subject_code: code, subject_name: name })
    .eq('id', input.subjectId)
    .select('id')
  if (error) {
    // subjects is unique on (subject_code, department_id).
    if ((error as { code?: string }).code === '23505') return { error: `Another subject in this department already uses the code ${code}.` }
    return { error: friendlyError('updateSubject', error, `We couldn't save this subject. ${RETRY_HINT}`) }
  }
  if (!updated?.length) return { error: 'This subject no longer exists.' }

  const changes = Object.entries(input.teachers ?? {}).slice(0, 500)
  if (changes.length) {
    const [{ data: classes, error: classErr }, { data: teachers, error: teacherErr }] = await Promise.all([
      supabase.from('class_offerings').select('id, teacher_id').eq('subject_id', input.subjectId),
      supabase.from('profiles').select('id').eq('role', 'subject_teacher'),
    ])
    if (classErr || teacherErr) return { error: friendlyError('updateSubject.read', classErr ?? teacherErr, `The subject was saved, but its teachers could not be checked. ${RETRY_HINT}`) }
    const current = new Map((classes ?? []).map((c) => [c.id as string, (c.teacher_id as string | null) ?? null]))
    const isTeacher = new Set((teachers ?? []).map((t) => t.id as string))

    for (const [classId, teacherId] of changes) {
      if (!current.has(classId)) continue
      const next = teacherId || null
      if (next && !isTeacher.has(next)) return { error: 'Pick a teacher from the list.' }
      if (current.get(classId) === next) continue
      const { error: e } = await supabase.from('class_offerings').update({ teacher_id: next }).eq('id', classId)
      if (e) return { error: friendlyError('updateSubject.teacher', e, `The subject was saved, but a section's teacher could not be. ${RETRY_HINT}`) }
    }
  }

  revalidatePath('/admin/subjects')
  revalidatePath('/admin/users')
  return { error: null }
}
