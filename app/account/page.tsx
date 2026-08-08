import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import ProfileForm from './ProfileForm'
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

  return (
    <div className="max-w-2xl">
      <Link
        href={ROLE_HOME[role] ?? '/'}
        className="inline-flex items-center gap-1 text-sm ef-muted hover:underline mb-4"
      >
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>My Account</h1>
      <p className="text-sm ef-muted mb-6">Manage your personal information and password.</p>

      {/* Role assignment (managed by the admin — shown here for reference) */}
      {(role === 'subject_teacher' || role === 'program_head') && (
        <div className="ef-card rounded-xl shadow-sm p-5 mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide ef-muted mb-2">Assignment</h2>
          {role === 'program_head' && (
            <p className="text-sm" style={{ color: 'var(--card-foreground)' }}>
              <span className="ef-muted">Department Program Head: </span>
              <strong>{deptName ?? 'No department assigned'}</strong>
            </p>
          )}
          {role === 'subject_teacher' && (
            <>
              {deptName && (
                <p className="text-sm mb-1" style={{ color: 'var(--card-foreground)' }}>
                  <span className="ef-muted">Department: </span><strong>{deptName}</strong>
                </p>
              )}
              <p className="text-sm ef-muted mb-1">Dedicated subject{mySubjects.length === 1 ? '' : 's'}:</p>
              {mySubjects.length ? (
                <ul className="space-y-1">
                  {mySubjects.map((s) => (
                    <li key={s.subject_code} className="text-sm" style={{ color: 'var(--card-foreground)' }}>
                      <strong>{s.subject_code}</strong> — {s.subject_name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm ef-muted">No subject assigned yet.</p>
              )}
            </>
          )}
        </div>
      )}

      <ProfileForm profile={profile as unknown as Profile} />
    </div>
  )
}
