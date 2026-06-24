'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function clean(v: FormDataEntryValue | null, max = 120) {
  return String(v ?? '').trim().slice(0, max)
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const fullName = clean(formData.get('full_name'))
  if (!fullName) return { error: 'Full name is required' }

  // Only ever touch safe, self-editable fields — never role / is_active.
  const yearRaw = clean(formData.get('year_level'), 4)
  const yearLevel = yearRaw ? Number(yearRaw) : null
  if (yearLevel !== null && (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6)) {
    return { error: 'Year level must be between 1 and 6' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      student_number: clean(formData.get('student_number'), 40) || null,
      course: clean(formData.get('course'), 60) || null,
      year_level: yearLevel,
      section: clean(formData.get('section'), 20) || null,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/account')
  revalidatePath('/', 'layout')
  return { error: null, ok: 'Profile updated successfully.' }
}
