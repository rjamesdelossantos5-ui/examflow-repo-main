import { createClient } from '@/lib/supabase/server'
import UserTable, { type TeacherClass } from './UserTable'
import { getCurrentUser } from '@/lib/currentUser'
import { isSettingOn, TOGGLE_SETTINGS } from '@/lib/settings'

export const metadata = { title: 'EXAMFLOW Admin — Users' }

export default async function UsersPage() {
  const supabase = await createClient()

  const [{ data: users }, { data: departments }, { data: offerings }, me, adminRemovalOn] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('departments').select('*').order('name'),
    supabase.from('class_offerings').select('section, teacher_id, subjects(subject_code, subject_name)').not('teacher_id', 'is', null),
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

  return (
    <div className="space-y-6">
      {/* Accounts arrive in bulk from the School Data import; this page is for
          finding, adding one-off, editing, deactivating and deleting accounts. */}
      <UserTable
        users={users ?? []}
        departments={departments ?? []}
        classesByTeacher={classesByTeacher}
        currentUserId={me?.id ?? null}
        adminRemovalOn={adminRemovalOn}
      />
    </div>
  )
}
