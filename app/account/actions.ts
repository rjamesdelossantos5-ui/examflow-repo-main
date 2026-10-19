'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isValidStudentNumber, isValidCode } from '@/lib/validation'
import { studentNumberFromEmail } from '@/lib/studentNumber'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'

function clean(v: FormDataEntryValue | null, max = 120) {
  return String(v ?? '').trim().slice(0, max)
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Only ever touch safe, self-editable fields — never role / is_active, and
  // never full_name (it comes from the Microsoft 365 account).
  const yearRaw = clean(formData.get('year_level'), 4)
  const yearLevel = yearRaw ? Number(yearRaw) : null
  if (yearLevel !== null && (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6)) {
    return { error: 'Year level must be between 1 and 6' }
  }

  // Validate the free-text identity fields so they can't hold junk.
  // A student whose school email carries their number gets it from the email,
  // whatever the form sent. Everyone else keeps the editable field.
  // Once saved it is never sent again: a database guard refuses changes to it.
  const { data: me } = await supabase.from('profiles').select('role, email, student_number').eq('id', user.id).single()
  const fromEmail = me?.role === 'student' ? studentNumberFromEmail(me.email) : null
  const studentNumber = fromEmail ?? clean(formData.get('student_number'), 40)
  const numberAlreadySaved = !!me?.student_number
  if (!numberAlreadySaved && studentNumber && !isValidStudentNumber(studentNumber)) {
    return { error: 'Enter a valid student number (digits only, e.g. 2024-00001).' }
  }
  const course = clean(formData.get('course'), 60)
  if (course && !isValidCode(course)) return { error: 'Enter a valid course (letters and numbers only).' }
  // Section is not edited here. It comes from the School Data import and is left
  // untouched, so saving this page never blanks it.

  const { error } = await supabase
    .from('profiles')
    .update({
      ...(numberAlreadySaved ? {} : { student_number: studentNumber || null }),
      course: course || null,
      year_level: yearLevel,
    })
    .eq('id', user.id)

  if (error) return { error: friendlyError('updateProfile', error, `We couldn't save your changes. ${RETRY_HINT}`) }

  revalidatePath('/account')
  revalidatePath('/', 'layout')
  return { error: null, ok: 'Profile updated successfully.' }
}
