'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, RETRY_HINT } from '@/lib/actionError'

// Admin CRUD for departments. Deleting a department does NOT delete its
// subjects/teachers — their department_id becomes null (FK is on delete set
// null, see supabase/schema.sql).

function sanitize(v: unknown) {
  return String(v ?? '').trim().slice(0, 200)
}

// All three actions re-verify the admin role server-side; returning null
// makes the caller answer "Unauthorized" without touching the DB.
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return null
  return supabase
}

export async function createDepartment(formData: FormData) {
  const supabase = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const name = sanitize(formData.get('name'))
  if (!name) return { error: 'Name is required' }

  const { error } = await supabase.from('departments').insert({ name })
  if (error) return { error: friendlyError('createDepartment', error, `We couldn't create that department. It may already exist. ${RETRY_HINT}`) }

  revalidatePath('/admin/departments')
  return { error: null }
}

export async function updateDepartment(id: string, formData: FormData) {
  const supabase = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const name = sanitize(formData.get('name'))
  if (!name) return { error: 'Name is required' }

  const { error } = await supabase.from('departments').update({ name }).eq('id', id)
  if (error) return { error: friendlyError('updateDepartment', error, `We couldn't rename that department. ${RETRY_HINT}`) }

  revalidatePath('/admin/departments')
  return { error: null }
}

export async function deleteDepartment(id: string) {
  const supabase = await requireAdmin()
  if (!supabase) return { error: 'Unauthorized' }

  const { error } = await supabase.from('departments').delete().eq('id', id)
  if (error) return { error: friendlyError('deleteDepartment', error, `We couldn't delete that department. ${RETRY_HINT}`) }

  revalidatePath('/admin/departments')
  return { error: null }
}
