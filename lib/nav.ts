import type { UserRole } from '@/lib/supabase/types'

// Where each role lands right after login (see app/login/actions.ts).
export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  registrar: '/registrar/dashboard',
  subject_teacher: '/teacher/dashboard',
  program_head: '/program-head/dashboard',
  student: '/student',
}
