import { createClient } from '@/lib/supabase/server'
import UserTable, { type TeacherClass, type ClassOption } from './UserTable'
import { getCurrentUser } from '@/lib/currentUser'
import { isSettingOn, TOGGLE_SETTINGS } from '@/lib/settings'

export const metadata = { title: 'EXAMFLOW Admin — Users' }

export default async function UsersPage() {
  const supabase = await createClient()

  const [{ data: users }, { data: departments }, { data: offerings }, { data: allClasses }, { data: programRows }, me, adminRemovalOn] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('departments').select('*').order('name'),
    supabase.from('class_offerings').select('section, teacher_id, subjects(subject_code, subject_name)').not('teacher_id', 'is', null),
    // Every class (subject + section), with or without a teacher: the choices for a student's section and for a new teacher's classes.
    supabase.from('class_offerings').select('id, section, teacher_id, subjects(subject_code, subject_name)'),
    supabase.from('program_departments').select('program, name'),
    getCurrentUser(),
    isSettingOn(supabase, TOGGLE_SETTINGS.adminAccountRemoval),
  ])

  // What each teacher teaches, shown when their name is clicked.
  const classesByTeacher: Record<string, TeacherClass[]> = {}
  for (const o of offerings ?? []) {
    const s = o.subjects as unknown as { subject_code: string; subject_name: string } | null
    ;(classesByTeacher[o.teacher_id as string] ??= []).push({
      section: o.section as string,
      code: s?.subject_code ?? '—',
      name: s?.subject_name ?? '',
    })
  }
  for (const list of Object.values(classesByTeacher)) {
    list.sort((a, b) => a.code.localeCompare(b.code) || a.section.localeCompare(b.section))
  }

  const sections = [...new Set((allClasses ?? []).map((o) => String(o.section)))].sort((a, b) => a.localeCompare(b))
  const nameById = new Map((users ?? []).map((u) => [u.id as string, u.full_name as string]))
  const classOptions: ClassOption[] = (allClasses ?? []).map((o) => {
    const sub = o.subjects as unknown as { subject_code: string; subject_name: string } | null
    return { id: o.id as string, section: o.section as string, code: sub?.subject_code ?? '—', name: sub?.subject_name ?? '', teacher: o.teacher_id ? nameById.get(o.teacher_id as string) ?? 'another teacher' : null }
  }).sort((a, b) => a.code.localeCompare(b.code) || a.section.localeCompare(b.section))
  const courseNames = Object.fromEntries((programRows ?? []).filter((p) => p.name).map((p) => [p.program as string, p.name as string]))

  return (
    <div className="space-y-6">
      {/* Accounts arrive in bulk from the School Data import; this page is for
          finding, adding one-off, editing, deactivating and deleting accounts. */}
      <UserTable
        users={users ?? []}
        departments={departments ?? []}
        sections={sections}
        classOptions={classOptions}
        courseNames={courseNames}
        classesByTeacher={classesByTeacher}
        currentUserId={me?.id ?? null}
        adminRemovalOn={adminRemovalOn}
      />
    </div>
  )
}
