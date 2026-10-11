'use client'

import { useState, useTransition } from 'react'
import { updateProfile } from './actions'
import { initials } from '@/lib/initials'
import type { Profile } from '@/lib/supabase/types'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  student: 'Student',
}

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
 * My Account page: edit your own name (and, for students, the details that
 * pre-fill the submit form — student number, course, year, section). Email
 * and role are read-only here; only the admin can change those. Note: edits
 * do NOT rewrite past requests — those keep the snapshot taken at submit time.
 */
export default function ProfileForm({ profile, assignment }: { profile: Profile; assignment?: React.ReactNode }) {
  const isStudent = profile.role === 'student'
  const [isPending, startTransition] = useTransition()
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function onProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateProfile(fd)
      setProfileMsg(res.error ? { kind: 'err', text: res.error } : { kind: 'ok', text: res.ok ?? 'Saved.' })
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
            <input name="full_name" required autoComplete="name" defaultValue={profile.full_name} className={inputClass} />
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
                Student number <span className="font-normal text-2xs">(optional)</span>
              </label>
              <input name="student_number" defaultValue={profile.student_number ?? ''} className={inputClass} placeholder="e.g. 2024-00001" inputMode="numeric" maxLength={40} pattern="[0-9-]{4,20}" title="Digits only (with optional dashes), e.g. 2024-00001" />
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Course</label>
              <input name="course" defaultValue={profile.course ?? ''} className={inputClass} placeholder="e.g. BSIT" />
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Year level</label>
              <input name="year_level" type="number" min={1} max={6} defaultValue={profile.year_level ?? ''} className={inputClass} placeholder="1-6" />
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Section</label>
              <input name="section" defaultValue={profile.section ?? ''} className={inputClass} placeholder="e.g. A" />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="ef-press px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
