import type { UserRole } from '@/lib/supabase/types'

// Where each role lands right after login (see app/login/actions.ts).
export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  registrar: '/registrar',
  subject_teacher: '/teacher',
  program_head: '/program-head',
  student: '/student',
}
