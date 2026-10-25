'use client'

import { useState, useTransition } from 'react'
import { updateProfile } from './actions'
import { initials } from '@/lib/initials'
import Select from '@/components/Select'
import { toastSuccess } from '@/components/Toaster'
import { programOf, yearOf } from '@/lib/schoolData'
import type { Profile } from '@/lib/supabase/types'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  student: 'Student',
}

const YEARS = [1, 2, 3, 4]

const inputClass =
  'w-full rounded-lg px-3 py-2.5 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)] focus:border-transparent'

function Banner({ kind, text }: { kind: 'ok' | 'err'; text: string }) {
  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm border ${
        kind === 'ok'
          ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300'
          : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300'
      }`}
    >
      {text}
    </div>
  )
}

/**
 * My Account page: for students, edit the details that pre-fill the submit
 * form — student number, course, year. Name (from the Microsoft 365
 * account), email and role are read-only here. Note: edits
 * do NOT rewrite past requests — those keep the snapshot taken at submit time.
 */
export default function ProfileForm({ profile, assignment, studentNumberLocked = false, courses = [], sections = [] }: { profile: Profile; assignment?: React.ReactNode; studentNumberLocked?: boolean; courses?: { code: string; name: string | null }[]; sections?: string[] }) {
  const isStudent = profile.role === 'student'
  const [isPending, startTransition] = useTransition()
  // Course, year and section depend on each other: the section list shows only
  // the chosen course and year, and a section that no longer fits is cleared.
  const [course, setCourse] = useState(profile.course ?? '')
  const [year, setYear] = useState(profile.year_level ? String(profile.year_level) : '')
  const [section, setSection] = useState(profile.section ?? '')
  const courseKey = (c: string) => c.toUpperCase().replace(/[^A-Z]/g, '')
  const fits = (s: string, c: string, y: string) =>
    (!c || programOf(s) === courseKey(c)) && (!y || yearOf(s) === null || yearOf(s) === Number(y))
  const sectionOptions = sections.filter((s) => fits(s, course, year))
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function onProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateProfile(fd)
      setProfileMsg(res.error ? { kind: 'err', text: res.error } : { kind: 'ok', text: res.ok ?? 'Saved.' })
      if (!res.error) toastSuccess('Profile updated')
    })
  }

  // One card: who you are on top (name, role, email), the editable fields
  // below. The fields sit side by side on wide screens instead of one tall
  // column, so the page doesn't leave half the screen empty.
  return (
    <form onSubmit={onProfileSubmit} className="ef-card rounded-xl shadow-sm">
      <div className="px-5 sm:px-6 py-4 flex items-center gap-3.5 border-b ef-border">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black shrink-0"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {initials(profile.full_name)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate flex items-center gap-2" style={{ color: 'var(--card-foreground)' }}>
            <span className="truncate">{profile.full_name}</span>
            <span className="shrink-0 px-2 py-0.5 rounded-full text-2xs font-semibold" style={{ background: 'color-mix(in srgb, var(--sti-gold) 22%, transparent)', color: 'var(--card-foreground)' }}>
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          </p>
          <p className="text-sm ef-muted truncate">{profile.email}</p>
        </div>
      </div>

      {assignment && <div className="px-5 sm:px-6 py-4 border-b ef-border">{assignment}</div>}

      <div className="p-5 sm:p-6 space-y-5">
        {profileMsg && <Banner kind={profileMsg.kind} text={profileMsg.text} />}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium ef-muted mb-1">Full name *</label>
            <input value={profile.full_name} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
            <p className="text-xs ef-muted mt-1">Name comes from your Microsoft 365 account and can't be changed here.</p>
          </div>
          <div>
            <label className="block text-sm font-medium ef-muted mb-1">Email</label>
            <input value={profile.email} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
            <p className="text-xs ef-muted mt-1">Email is managed by your administrator.</p>
          </div>
        </div>

        {isStudent && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">
                Student number {!studentNumberLocked && <span className="font-normal text-2xs">(optional)</span>}
              </label>
              {studentNumberLocked ? (
                <>
                  <input value={profile.student_number ?? ''} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
                  <p className="text-xs ef-muted mt-1">From your school email.</p>
                </>
              ) : (
                <input name="student_number" defaultValue={profile.student_number ?? ''} className={inputClass} placeholder="e.g. 2024-00001" inputMode="numeric" maxLength={40} pattern="[0-9-]{4,20}" title="Digits only (with optional dashes), e.g. 2024-00001" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Course</label>
              {courses.length ? (
                <Select
                  name="course"
                  value={course}
                  onChange={(v) => { setCourse(v); if (section && !fits(section, v, year)) setSection('') }}
                  placeholder="— Select course —"
                  // A course already saved stays selectable even if it is not on the list.
                  options={[
                    ...courses.map((c) => ({ value: c.code, label: c.name ? `${c.code} — ${c.name}` : c.code })),
                    ...(profile.course && !courses.some((c) => c.code === profile.course) ? [{ value: profile.course, label: profile.course }] : []),
                  ]}
                  className={inputClass}
                />
              ) : (
                // No programs imported yet: typing still works so an account can be filled in.
                <input name="course" defaultValue={profile.course ?? ''} className={inputClass} placeholder="e.g. BSIT" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Year level</label>
              <Select
                name="year_level"
                value={year}
                onChange={(v) => { setYear(v); if (section && !fits(section, course, v)) setSection('') }}
                placeholder="— Select year —"
                options={[
                  ...YEARS.map((y) => ({ value: String(y), label: `Year ${y}` })),
                  // A year already saved outside 1-4 stays selectable.
                  ...(profile.year_level && !YEARS.includes(profile.year_level) ? [{ value: String(profile.year_level), label: `Year ${profile.year_level}` }] : []),
                ]}
                className={inputClass}
              />
            </div>
            {/* Not shown until classes exist: with nothing to pick from, the field is
                left out of the form, so saving never blanks a section an admin set. */}
            {sections.length > 0 && (
              <div>
                <label className="block text-sm font-medium ef-muted mb-1">Section</label>
                <Select
                  name="section"
                  value={section}
                  onChange={setSection}
                  placeholder={sectionOptions.length ? '— Select section —' : 'No sections for that course and year'}
                  options={sectionOptions.map((s) => ({ value: s, label: s }))}
                  className={inputClass}
                />
              </div>
            )}
          </div>
        )}

        {/* Only students have anything to save here (student number, course, year).
            Staff see their name and email, which can't be edited on this page. */}
        {isStudent && (
          <button
            type="submit"
            disabled={isPending}
            className="ef-press px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>
    </form>
  )
}
