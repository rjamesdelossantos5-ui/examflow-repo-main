import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import ProfileForm from './ProfileForm'
import { studentNumberFromEmail } from '@/lib/studentNumber'
import { ROLE_HOME } from '@/lib/nav'
import type { Profile, UserRole } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — My Account' }

export default async function AccountPage() {
  const supabase = await createClient()
  // Cached — reuses the layout's auth lookup instead of a second round-trip.
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Full row (all columns + department) — the narrow cached getMyProfileMeta
  // doesn't cover what the edit form needs, so this query stays.
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, departments(name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role as UserRole

  // Programs from the School Data import, for the student's course dropdown.
  let courses: { code: string; name: string | null }[] = []
  // Every section that has classes ("BSIT 2-201"), for the student's section
  // dropdown. The form narrows it to the chosen course and year.
  let sections: string[] = []
  if (role === 'student') {
    const [{ data: programRows }, { data: classRows }] = await Promise.all([
      supabase.from('program_departments').select('program, name').order('program'),
      supabase.from('class_offerings').select('section'),
    ])
    courses = (programRows ?? []).map((p) => ({ code: p.program as string, name: (p.name as string | null) ?? null }))
    sections = [...new Set((classRows ?? []).map((c) => String(c.section)))].sort((a, b) => a.localeCompare(b))
  }
  const deptName = (profile.departments as unknown as { name: string } | null)?.name ?? null

  // A subject teacher's dedicated subject(s) — the ones that route to them.
  let mySubjects: { subject_code: string; subject_name: string }[] = []
  if (role === 'subject_teacher') {
    const { data } = await supabase
      .from('subjects')
      .select('subject_code, subject_name')
      .eq('teacher_id', user.id)
      .order('subject_code')
    mySubjects = data ?? []
  }

  // Teacher / Program Head assignment (set by the admin, shown for reference),
  // as label–value rows inside the account card.
  const assignment = role === 'program_head' ? (
    <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-y-1 text-sm">
      <dt className="ef-muted">Department</dt>
      <dd className="font-medium" style={{ color: 'var(--card-foreground)' }}>{deptName ?? 'No department assigned'}</dd>
    </dl>
  ) : role === 'subject_teacher' ? (
    <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-y-1 text-sm">
      {deptName && (
        <>
          <dt className="ef-muted">Department</dt>
          <dd className="font-medium" style={{ color: 'var(--card-foreground)' }}>{deptName}</dd>
        </>
      )}
      <dt className="ef-muted">Subject{mySubjects.length === 1 ? '' : 's'}</dt>
      <dd style={{ color: 'var(--card-foreground)' }}>
        {mySubjects.length ? (
          <ul className="space-y-0.5">
            {mySubjects.map((s) => (
              <li key={s.subject_code}><strong>{s.subject_code}</strong> {s.subject_name}</li>
            ))}
          </ul>
        ) : (
          <span className="ef-muted">No subject assigned yet.</span>
        )}
      </dd>
    </dl>
  ) : null

  return (
    // Full width of the dashboard, like the other dashboard pages.
    <div>
      <Link
        href={ROLE_HOME[role] ?? '/'}
        className="ef-press inline-flex items-center gap-1 text-sm font-semibold px-3.5 py-2 rounded-lg mb-3"
        style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
      >
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>My Account</h1>
      <p className="text-sm ef-muted mt-1 mb-5">Manage your personal information.</p>

      <ProfileForm
        assignment={assignment}
        profile={{
          ...(profile as unknown as Profile),
          // Blank for school accounts until the student saves it — pre-fill it
          // from their school email (lib/studentNumber.ts).
          student_number: (role === 'student' ? studentNumberFromEmail(profile.email) : null) ?? profile.student_number,
        }}
        studentNumberLocked={role === 'student' && studentNumberFromEmail(profile.email) !== null}
        courses={courses}
        sections={sections}
      />
    </div>
  )
}
