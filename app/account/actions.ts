'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isValidName, isValidStudentNumber, isValidCode } from '@/lib/validation'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'

function clean(v: FormDataEntryValue | null, max = 120) {
  return String(v ?? '').trim().slice(0, max)
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const fullName = clean(formData.get('full_name'))
  if (!fullName) return { error: 'Full name is required' }
  if (!isValidName(fullName)) return { error: 'Enter a valid full name (letters only).' }

  // Only ever touch safe, self-editable fields — never role / is_active.
  const yearRaw = clean(formData.get('year_level'), 4)
  const yearLevel = yearRaw ? Number(yearRaw) : null
  if (yearLevel !== null && (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6)) {
    return { error: 'Year level must be between 1 and 6' }
  }

  // Validate the free-text identity fields so they can't hold junk.
  const studentNumber = clean(formData.get('student_number'), 40)
  if (studentNumber && !isValidStudentNumber(studentNumber)) {
    return { error: 'Enter a valid student number (digits only, e.g. 2024-00001).' }
  }
  const course = clean(formData.get('course'), 60)
  if (course && !isValidCode(course)) return { error: 'Enter a valid course (letters and numbers only).' }
  const section = clean(formData.get('section'), 20)
  if (section && !isValidCode(section)) return { error: 'Enter a valid section (letters and numbers only).' }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      student_number: studentNumber || null,
      course: course || null,
      year_level: yearLevel,
      section: section || null,
    })
    .eq('id', user.id)

  if (error) return { error: friendlyError('updateProfile', error, `We couldn't save your changes. ${RETRY_HINT}`) }

  revalidatePath('/account')
  revalidatePath('/', 'layout')
  return { error: null, ok: 'Profile updated successfully.' }
}
