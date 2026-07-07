'use client'

import { useState, useTransition } from 'react'
import { updateProfile } from './actions'
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
export default function ProfileForm({ profile }: { profile: Profile }) {
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

  return (
    <div className="space-y-6">
      {/* Identity card */}
      <div className="ef-card rounded-xl shadow-sm p-6 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black shrink-0"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {profile.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-lg truncate" style={{ color: 'var(--card-foreground)' }}>{profile.full_name}</p>
          <p className="text-sm ef-muted truncate">{profile.email}</p>
          <span
            className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
          >
            {ROLE_LABELS[profile.role] ?? profile.role}
          </span>
        </div>
      </div>

      {/* Personal info */}
      <form onSubmit={onProfileSubmit} className="ef-card rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Personal Information</h2>
        {profileMsg && <Banner kind={profileMsg.kind} text={profileMsg.text} />}

        <div>
          <label className="block text-sm font-medium ef-muted mb-1">Full name *</label>
          <input name="full_name" required defaultValue={profile.full_name} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium ef-muted mb-1">Email</label>
          <input value={profile.email} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
          <p className="text-xs ef-muted mt-1">Email is managed by your administrator.</p>
        </div>

        {isStudent && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Student number</label>
              <input name="student_number" defaultValue={profile.student_number ?? ''} className={inputClass} placeholder="e.g. 2024-00001" />
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

        <div className="pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
