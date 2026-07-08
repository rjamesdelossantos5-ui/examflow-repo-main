'use client'

import { useRef, useState } from 'react'
import { submitRequest } from './actions'
import SubmitButton from '@/components/SubmitButton'
import { Icon } from '@/components/Icon'
import { compressImage } from '@/lib/compressImage'
import Select from '@/components/Select'

// One (subject + section → teacher) row. The student picks a subject, then a
// section available for it, and the teacher for that section fills in.
export interface Offering {
  subjectId: string
  subjectCode: string
  subjectName: string
  section: string
  yearLevel: number | null
  teacherName: string | null
}

const MAX_MB = 5
const ALLOWED = '.jpg,.jpeg,.png,.pdf'

const REASONS = [
  { value: 'medical', label: 'Medical', desc: 'Illness or hospitalization', doc: 'Medical Certificate' },
  { value: 'bereavement', label: 'Bereavement', desc: 'Death in the family', doc: 'Death Certificate' },
  { value: 'other', label: 'Other', desc: 'Another valid reason', doc: 'Supporting Document' },
] as const

// Course catalog — trimmed to 2 for testing: one tertiary (BSIT, matches the
// ICT offerings) and one senior-high strand (STEM, matches the SHS offerings).
// Sections themselves come from class_offerings, not from a hardcoded list.
const COURSES: { code: string; name: string }[] = [
  { code: 'BSIT', name: 'BS Information Technology' },
  { code: 'STEM', name: 'Science, Technology, Engineering & Mathematics' },
]
const YEARS = [1, 2, 3, 4]

interface ProfileInfo {
  full_name: string
  student_number: string
  course: string
  year_level: number | null
  section: string
}

interface Prefill {
  fromId: string
  subjectId: string | null
  examType: 'paid' | 'excused'
  excusedReason: 'medical' | 'bereavement' | 'other' | null
  otherReason: string | null
  fullName: string | null
  studentNumber: string | null
  course: string | null
  yearLevel: number | null
  section: string | null
  contactNumber: string | null
}

export default function SubmitForm({ offerings, termLabel, profile, error, submissionOpen = true, windowMessage, prefill, existingDocs = [] }: { offerings: Offering[]; termLabel?: string | null; profile: ProfileInfo; error?: string; submissionOpen?: boolean; windowMessage?: string | null; prefill?: Prefill | null; existingDocs?: string[] }) {
  const kept = new Set(existingDocs)
  // Effective values: a resubmit's saved snapshot overrides the profile defaults.
  const eff = {
    full_name: prefill?.fullName ?? profile.full_name,
    student_number: prefill?.studentNumber ?? profile.student_number,
    course: prefill?.course ?? profile.course,
    year_level: prefill?.yearLevel ?? profile.year_level,
    section: prefill?.section ?? profile.section,
  }

  const [examType, setExamType] = useState<'paid' | 'excused'>(prefill?.examType ?? 'paid')
  const [reason, setReason] = useState<'medical' | 'bereavement' | 'other' | ''>(prefill?.excusedReason ?? '')
  const [course, setCourse] = useState(COURSES.some((c) => c.code === eff.course) ? eff.course : '')
  const [yearLevel, setYearLevel] = useState(eff.year_level ? String(eff.year_level) : '')
  const [subjectId, setSubjectId] = useState(prefill?.subjectId ?? '')
  const [section, setSection] = useState(eff.section ?? '')
  const [confirming, setConfirming] = useState(false)

  // A section name like "BSIT 2-201" or "STEM 11-A" leads with the course /
  // strand code. Comparing that prefix to the chosen course is how "BSIT"
  // students only see BSIT sections (and never SHS ones, etc.) — the class
  // offering data doesn't need a separate department field for this to work.
  const coursePrefix = (section: string) => (section.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase()
  const normalizeCourse = (c: string) => c.toUpperCase().replace(/[^A-Z]/g, '')

  // Only offerings whose section matches the chosen course. Nothing shows until
  // a course is picked, so a subject never leaks in from another program.
  const courseOfferings = course ? offerings.filter((o) => coursePrefix(o.section) === normalizeCourse(course)) : []

  const subjectOptions = Array.from(
    new Map(courseOfferings.map((o) => [o.subjectId, { id: o.subjectId, code: o.subjectCode, name: o.subjectName }])).values(),
  )
  // Sections available for the chosen subject (and year, when the offering
  // specifies one).
  const yearNum = yearLevel ? Number(yearLevel) : null
  const sectionOptions = courseOfferings.filter(
    (o) => o.subjectId === subjectId && (yearNum == null || o.yearLevel == null || o.yearLevel === yearNum),
  )
  const teacherName = courseOfferings.find((o) => o.subjectId === subjectId && o.section === section)?.teacherName ?? null

  const formRef = useRef<HTMLFormElement>(null)

  function openConfirm() {
    if (!submissionOpen) return
    if (formRef.current?.reportValidity()) setConfirming(true)
  }

  const docLabel = REASONS.find((r) => r.value === reason)?.doc ?? 'Supporting Document'
  const inputClass =
    'w-full rounded-lg px-3 py-2.5 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)] focus:border-transparent'
  const selectClass = `${inputClass} cursor-pointer`
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

      {prefill && (
        <div className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--sti-gold) 12%, transparent)', borderColor: 'rgba(253,185,19,0.4)', color: 'var(--card-foreground)' }}>
          Resubmitting a rejected request — your details and files are kept. Just fix what was wrong; you only need to re-upload a file if you want to replace it.
        </div>
      )}

      <form ref={formRef} action={submitRequest} className="ef-card rounded-xl shadow-sm p-6 space-y-6">
        {prefill?.fromId && <input type="hidden" name="resubmit_from" value={prefill.fromId} />}

        {/* Exam type — first thing the student decides */}
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

        {/* Excused reason — right under Exam Type, since it only applies when Excused is chosen */}
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
        {examType === 'excused' && reason === 'other' && (
          <div>
            <label className="block text-sm font-medium ef-muted mb-1">Please specify *</label>
            <input name="other_reason" required maxLength={500} defaultValue={prefill?.otherReason ?? ''} className={inputClass} placeholder="Briefly describe the reason" />
          </div>
        )}

        {/* Your information */}
        <div className="space-y-4 pb-2 border-b ef-border">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--card-foreground)' }}>Your Information</h2>
          {termLabel && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'color-mix(in srgb, var(--sti-gold) 12%, transparent)', color: 'var(--card-foreground)' }}>
              <span className="ef-muted">Term / SY: </span><strong>{termLabel}</strong>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium ef-muted mb-1">Full name</label>
            <input
              name="full_name"
              required
              readOnly
              value={eff.full_name}
              className={`${inputClass} cursor-not-allowed opacity-70`}
            />
            <p className="mt-1 text-xs ef-muted">Matches your account — contact the Registrar if this is wrong.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Contact number *</label>
              <input
                name="contact_number"
                required
                defaultValue={prefill?.contactNumber ?? ''}
                className={inputClass}
                placeholder="09XX XXX XXXX"
                inputMode="tel"
                maxLength={40}
                pattern="[0-9+ ()-]{10,15}"
                title="Enter a valid contact number — digits only, e.g. 09171234567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Student number</label>
              <input
                name="student_number"
                defaultValue={eff.student_number}
                className={inputClass}
                placeholder="2024-00001"
                inputMode="numeric"
                maxLength={40}
                pattern="[0-9-]{4,20}"
                title="Student number should be digits (with optional dashes), e.g. 2024-00001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Course / Program *</label>
              <Select
                name="course"
                required
                value={course}
                onChange={(v) => { setCourse(v); setSubjectId(''); setSection('') }}
                placeholder="— Select course —"
                options={COURSES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
                className={selectClass}
                style={selectStyle}
              />
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Year level *</label>
              <Select
                name="year_level"
                required
                value={yearLevel}
                onChange={(v) => { setYearLevel(v); setSection('') }}
                placeholder="— Select year —"
                options={YEARS.map((y) => ({ value: String(y), label: `Year ${y}` }))}
                className={selectClass}
                style={selectStyle}
              />
            </div>
          </div>
        </div>

        {/* Subject → Section → Teacher (dynamic from the class offerings, scoped to the chosen course) */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium ef-muted mb-1">Subject *</label>
            <Select
              name="subject_id"
              required
              value={subjectId}
              onChange={(v) => { setSubjectId(v); setSection('') }}
              disabled={!course}
              placeholder={course ? '— Select a subject —' : 'Select a course first'}
              options={subjectOptions.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
              className={selectClass}
              style={selectStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium ef-muted mb-1">Section *</label>
            <Select
              name="section"
              required
              value={section}
              onChange={setSection}
              disabled={!subjectId}
              placeholder={!subjectId ? 'Select a subject first' : sectionOptions.length ? '— Select section —' : 'No sections for that subject/year'}
              options={sectionOptions.map((o) => ({ value: o.section, label: o.section }))}
              className={selectClass}
              style={selectStyle}
            />
          </div>

          {section && (
            <div className="rounded-lg px-3 py-2 text-sm border ef-border">
              <span className="ef-muted">Teacher: </span>
              <strong style={{ color: 'var(--card-foreground)' }}>{teacherName ?? 'Not assigned yet'}</strong>
              <p className="text-xs ef-muted mt-0.5">Your request will be sent to this section&apos;s teacher for approval.</p>
            </div>
          )}
        </div>

        {/* Parent documents */}
        <div className="space-y-4 pt-2 border-t ef-border">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--card-foreground)' }}>Parent / Guardian Documents</h2>
          <FileField name="parent_id" label="Valid ID — Front" hint="Clear photo of the ID front · JPG, PNG, or PDF · max 5 MB" inputClass={inputClass} kept={kept.has('parent_id')} />
          <FileField name="parent_id_back" label="Valid ID — Back" hint="Photo of the ID back · JPG, PNG, or PDF · max 5 MB" inputClass={inputClass} kept={kept.has('parent_id_back')} />
          <FileField name="parent_signature" label="Parent/Guardian Signature" hint="Signed consent · JPG, PNG, or PDF · max 5 MB" inputClass={inputClass} kept={kept.has('parent_signature')} />
        </div>

        {/* Reason-specific supporting document */}
        {examType === 'excused' && reason && (
          <FileField
            name="supporting_document"
            label={docLabel}
            hint={`Upload the ${docLabel.toLowerCase()} · JPG, PNG, or PDF · max 5 MB`}
            inputClass={inputClass}
            kept={kept.has('supporting_document')}
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

function FileField({ name, label, hint, inputClass, kept = false }: { name: string; label: string; hint: string; inputClass: string; kept?: boolean }) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function validate(file: File) {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) return 'Only JPG, PNG, or PDF allowed'
    if (file.size > MAX_MB * 1024 * 1024) return `Max ${MAX_MB} MB`
    return null
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const err = validate(f)
    if (err) {
      setFileError(err)
      setFileName(null)
      return
    }
    setFileError(null)

    // Phone photos are routinely several MB — shrinking them client-side
    // before upload is what keeps submission fast on mobile data.
    setBusy(true)
    const compressed = await compressImage(f)
    setBusy(false)
    if (compressed !== f && inputRef.current) {
      const dt = new DataTransfer()
      dt.items.add(compressed)
      inputRef.current.files = dt.files
    }
    setFileName(compressed.name)
  }

  return (
    <div>
      <label className="block text-sm font-medium ef-muted mb-1">{label} {kept ? <span className="text-xs font-normal">(optional — replace)</span> : '*'}</label>
      {kept && !fileName && (
        <p className="mb-1 text-xs text-green-600 dark:text-green-400">✓ Your previous file is kept. Upload only to replace it.</p>
      )}
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={ALLOWED}
        required={!kept}
        onChange={handleChange}
        className={`${inputClass} file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[var(--sti-gold)]/20 file:text-[var(--card-foreground)] file:cursor-pointer`}
      />
      {busy && <p className="mt-1 text-xs ef-muted">Optimizing photo…</p>}
      {fileError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fileError}</p>}
      {fileName && !fileError && !busy && <p className="mt-1 text-xs text-green-600 dark:text-green-400">✓ {fileName}</p>}
      <p className="mt-1 text-xs ef-muted">{hint}</p>
    </div>
  )
}
