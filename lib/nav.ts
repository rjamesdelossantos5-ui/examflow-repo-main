import type { UserRole } from '@/lib/supabase/types'

export interface NavItem {
  label: string
  href: string
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  student: [],
  registrar: [
    { label: 'Queue', href: '/registrar' },
    { label: 'History', href: '/registrar/history' },
  ],
  subject_teacher: [
    { label: 'Queue', href: '/teacher' },
    { label: 'History', href: '/teacher/history' },
  ],
  program_head: [
    { label: 'First Approval', href: '/program-head' },
    { label: 'Second Approval', href: '/program-head/receipts' },
    { label: 'Overview', href: '/program-head/overview' },
    { label: 'Students', href: '/program-head/students' },
    { label: 'Settings', href: '/program-head/settings' },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Departments', href: '/admin/departments' },
    { label: 'Subjects', href: '/admin/subjects' },
  ],
}

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  registrar: '/registrar',
  subject_teacher: '/teacher',
  program_head: '/program-head',
  student: '/student',
}
