'use client'

import { useRef, useState } from 'react'
import type { Subject } from '@/lib/supabase/types'
import { submitRequest } from './actions'
import SubmitButton from '@/components/SubmitButton'
import { Icon } from '@/components/Icon'

const MAX_MB = 5
const ALLOWED = '.jpg,.jpeg,.png,.pdf'

const REASONS = [
  { value: 'medical', label: 'Medical', desc: 'Illness or hospitalization', doc: 'Medical Certificate' },
  { value: 'bereavement', label: 'Bereavement', desc: 'Death in the family', doc: 'Death Certificate' },
  { value: 'other', label: 'Other', desc: 'Another valid reason', doc: 'Supporting Document' },
] as const

// Course catalog — sections depend on the chosen course (no free typing).
const COURSES: { code: string; name: string; sections: string[] }[] = [
  { code: 'BSIT', name: 'BS Information Technology', sections: ['A', 'B', 'C', 'D'] },
  { code: 'BSCS', name: 'BS Computer Science', sections: ['A', 'B', 'C'] },
  { code: 'BSCpE', name: 'BS Computer Engineering', sections: ['A', 'B'] },
  { code: 'BSIS', name: 'BS Information Systems', sections: ['A', 'B'] },
  { code: 'BSBA', name: 'BS Business Administration', sections: ['A', 'B', 'C', 'D'] },
  { code: 'BSHM', name: 'BS Hospitality Management', sections: ['A', 'B', 'C'] },
  { code: 'BSTM', name: 'BS Tourism Management', sections: ['A', 'B'] },
  { code: 'BSA', name: 'BS Accountancy', sections: ['A', 'B'] },
]
const YEARS = [1, 2, 3, 4]

interface ProfileInfo {
  full_name: string
  student_number: string
  course: string
  year_level: number | null
  section: string
}

export default function SubmitForm({ subjects, profile, error, submissionOpen = true, windowMessage }: { subjects: Subject[]; profile: ProfileInfo; error?: string; submissionOpen?: boolean; windowMessage?: string | null }) {
  const [examType, setExamType] = useState<'paid' | 'excused'>('paid')
  const [reason, setReason] = useState<'medical' | 'bereavement' | 'other' | ''>('')
  const [course, setCourse] = useState(COURSES.some((c) => c.code === profile.course) ? profile.course : '')
  const [section, setSection] = useState(profile.section ?? '')
  const [confirming, setConfirming] = useState(false)

  const formRef = useRef<HTMLFormElement>(null)

  const sectionsForCourse = COURSES.find((c) => c.code === course)?.sections ?? []

  function openConfirm() {
    if (!submissionOpen) return
    if (formRef.current?.reportValidity()) setConfirming(true)
  }

  const docLabel = REASONS.find((r) => r.value === reason)?.doc ?? 'Supporting Document'
  const inputClass =
    'w-full rounded-lg px-3 py-2.5 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)] focus:border-transparent'
  const selectClass = `${inputClass} appearance-none pr-9 cursor-pointer`
  const selectStyle = { backgroundColor: 'var(--card)', color: 'var(--card-foreground)' } as React.CSSProperties

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Submit New Request</h1>
      <p className="text-sm ef-muted mb-6">Complete the form below to request a special exam.</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {decodeURIComponent(error)}
        </div>
      )}

      {windowMessage && (
        <div className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', borderColor: 'rgba(245,158,11,0.4)', color: 'var(--card-foreground)' }}>
          {windowMessage}
        </div>
      )}

      <form ref={formRef} action={submitRequest} className="ef-card rounded-xl shadow-sm p-6 space-y-6">
        {/* Your information */}
        <div className="space-y-4 pb-2 border-b ef-border">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--card-foreground)' }}>Your Information</h2>
          <div>
            <label className="block text-sm font-medium ef-muted mb-1">Full name *</label>
            <input name="full_name" required defaultValue={profile.full_name} className={inputClass} placeholder="Juan Dela Cruz" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Student number</label>
              <input name="student_number" defaultValue={profile.student_number} className={inputClass} placeholder="2024-00001" />
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Course *</label>
              <div className="relative">
                <select
                  name="course"
                  required
                  value={course}
                  onChange={(e) => { setCourse(e.target.value); setSection('') }}
                  className={selectClass}
                  style={selectStyle}
                >
                  <option value="">— Select course —</option>
                  {COURSES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
                <Chevron />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Year level *</label>
              <div className="relative">
                <select name="year_level" required defaultValue={profile.year_level ?? ''} className={selectClass} style={selectStyle}>
                  <option value="">— Select year —</option>
                  {YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
                <Chevron />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Section *</label>
              <div className="relative">
                <select
                  name="section"
                  required
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  disabled={!course}
                  className={`${selectClass} disabled:opacity-50`}
                  style={selectStyle}
                >
                  <option value="">{course ? '— Select section —' : 'Select a course first'}</option>
                  {sectionsForCourse.map((s) => <option key={s} value={s}>Section {s}</option>)}
                </select>
                <Chevron />
              </div>
            </div>
          </div>
        </div>

        {/* Exam type */}
        <div>
          <label className="block text-sm font-medium ef-muted mb-2">Exam Type *</label>
          <div className="grid grid-cols-2 gap-3">
            {(['paid', 'excused'] as const).map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                  examType === t ? 'border-[var(--sti-gold)] bg-[var(--sti-gold)]/10' : 'ef-border hover:border-[var(--sti-gold)]/50'
                }`}
              >
                <input type="radio" name="exam_type" value={t} checked={examType === t} onChange={() => setExamType(t)} className="sr-only" />
                <Icon name={t === 'paid' ? 'receipt' : 'file'} className="w-6 h-6 mb-2" style={{ color: 'var(--card-foreground)' }} />
                <div className="font-semibold text-sm" style={{ color: 'var(--card-foreground)' }}>
                  {t === 'paid' ? 'Paid' : 'Excused'}
                </div>
                <div className="text-xs ef-muted">{t === 'paid' ? 'Unexcused absence' : 'With valid reason'}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium ef-muted mb-1">Subject *</label>
          <div className="relative">
            <select name="subject_id" required className={selectClass} style={selectStyle}>
              <option value="">— Select a subject —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.subject_code} — {s.subject_name}</option>
              ))}
            </select>
            <Chevron />
          </div>
        </div>

        {/* Excused reason cards */}
        {examType === 'excused' && (
          <div>
            <label className="block text-sm font-medium ef-muted mb-2">Reason for Absence *</label>
            <div className="grid sm:grid-cols-3 gap-3">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all ${
                    reason === r.value ? 'border-[var(--sti-gold)] bg-[var(--sti-gold)]/10' : 'ef-border hover:border-[var(--sti-gold)]/50'
                  }`}
                >
                  <input type="radio" name="excused_reason" value={r.value} required checked={reason === r.value} onChange={() => setReason(r.value)} className="sr-only" />
                  <div className="font-semibold text-sm" style={{ color: 'var(--card-foreground)' }}>{r.label}</div>
                  <div className="text-[10px] ef-muted leading-tight mt-0.5">{r.desc}</div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Specify other */}
        {examType === 'excused' && reason === 'other' && (
          <div>
            <label className="block text-sm font-medium ef-muted mb-1">Please specify *</label>
            <input name="other_reason" required maxLength={500} className={inputClass} placeholder="Briefly describe the reason" />
          </div>
        )}

        {/* Parent documents */}
        <div className="space-y-4 pt-2 border-t ef-border">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--card-foreground)' }}>Parent / Guardian Documents</h2>
          <FileField name="parent_id" label="Valid ID — Front *" hint="Clear photo of the ID front · JPG, PNG, or PDF · max 5 MB" inputClass={inputClass} />
          <FileField name="parent_id_back" label="Valid ID — Back *" hint="Photo of the ID back · JPG, PNG, or PDF · max 5 MB" inputClass={inputClass} />
          <FileField name="parent_signature" label="Parent/Guardian Signature *" hint="Signed consent · JPG, PNG, or PDF · max 5 MB" inputClass={inputClass} />
        </div>

        {/* Reason-specific supporting document */}
        {examType === 'excused' && reason && (
          <FileField
            name="supporting_document"
            label={`${docLabel} *`}
            hint={`Upload the ${docLabel.toLowerCase()} · JPG, PNG, or PDF · max 5 MB`}
            inputClass={inputClass}
          />
        )}

        {/* Opens the confirmation dialog (does not submit directly) */}
        <button
          type="button"
          onClick={openConfirm}
          disabled={!submissionOpen}
          className="w-full py-3 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {submissionOpen ? 'Submit Request' : 'Submissions Closed'}
        </button>

        {/* Confirmation dialog — the real submit lives here */}
        {confirming && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirming(false)}>
            <div className="ef-card rounded-xl shadow-xl max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center" style={{ background: 'color-mix(in srgb, var(--sti-gold) 18%, transparent)' }}>
                <Icon name="file" className="w-6 h-6" style={{ color: 'var(--sti-gold)' }} />
              </div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>Submit this request?</h3>
              <p className="text-sm ef-muted mt-1 mb-5">
                Please double-check your details and documents. Once submitted, it will be sent to the Registrar for review.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border"
                  style={{ color: 'var(--card-foreground)' }}
                >
                  Go Back
                </button>
                <SubmitButton
                  pendingText="Submitting…"
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                >
                  Yes, Submit
                </SubmitButton>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

function Chevron() {
  return (
    <svg className="w-4 h-4 ef-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function FileField({ name, label, hint, inputClass }: { name: string; label: string; hint: string; inputClass: string }) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function validate(file: File) {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) return 'Only JPG, PNG, or PDF allowed'
    if (file.size > MAX_MB * 1024 * 1024) return `Max ${MAX_MB} MB`
    return null
  }

  return (
    <div>
      <label className="block text-sm font-medium ef-muted mb-1">{label}</label>
      <input
        type="file"
        name={name}
        accept={ALLOWED}
        required
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            const err = validate(f)
            setFileError(err)
            setFileName(err ? null : f.name)
          }
        }}
        className={`${inputClass} file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[var(--sti-gold)]/20 file:text-[var(--card-foreground)] file:cursor-pointer`}
      />
      {fileError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fileError}</p>}
      {fileName && !fileError && <p className="mt-1 text-xs text-green-600 dark:text-green-400">✓ {fileName}</p>}
      <p className="mt-1 text-xs ef-muted">{hint}</p>
    </div>
  )
}
