'use client'

import { useErrorToast, toastError } from '@/components/Toaster'
import { useCallback, useRef, useState } from 'react'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { submitRequest } from './actions'
import SubmitButton from '@/components/SubmitButton'
import { Icon } from '@/components/Icon'
import { compressImage } from '@/lib/compressImage'
import Select from '@/components/Select'
import PrivacyNoticeSheet from '@/components/PrivacyNoticeSheet'
import { withoutAccountTag } from '@/lib/initials'
import { isValidPhone } from '@/lib/validation'

const PHONE_MSG = 'Enter a valid mobile number — 11 digits starting with 09, e.g. 09171234567'

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
const MAX_SUBJECTS = 7
const ALLOWED = '.jpg,.jpeg,.png,.pdf'

const REASONS = [
  { value: 'medical', label: 'Medical', desc: 'Illness or hospitalization', doc: 'Medical Certificate' },
  { value: 'bereavement', label: 'Bereavement', desc: 'Death in the family', doc: 'Death Certificate' },
  { value: 'other', label: 'Other', desc: 'Another valid reason', doc: 'Supporting Document' },
] as const

// Courses come from the classes themselves (the letters a section starts
// with: "BSIT 2-201" → BSIT), so a new program appears as soon as its classes
// are imported. Full names come from the School Data Programs sheet.
const YEARS = [1, 2, 3, 4]
const coursePrefix = (section: string) => (section.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase()
const normalizeCourse = (c: string) => c.toUpperCase().replace(/[^A-Z]/g, '')

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

export default function SubmitForm({ offerings, termLabel, profile, error, submissionOpen = true, windowMessage, prefill, existingDocs = [], enrolledSection = null, courseNames = {} }: { offerings: Offering[]; termLabel?: string | null; profile: ProfileInfo; error?: string; submissionOpen?: boolean; windowMessage?: string | null; prefill?: Prefill | null; existingDocs?: string[]; enrolledSection?: string | null; courseNames?: Record<string, string> }) {
  useErrorToast(error ? decodeURIComponent(error) : null)
  const kept = new Set(existingDocs)
  const courses = Array.from(new Set(offerings.map((o) => coursePrefix(o.section)).filter(Boolean))).sort()
  // The student's section from the School Data import: course, year and
  // section are filled in and only that section's classes are offered.
  const enrolled = enrolledSection && offerings.some((o) => o.section === enrolledSection) ? enrolledSection : null
  const enrolledYear = enrolled?.match(/^[A-Za-z]+\s+(\d)-/)?.[1] ?? null
  // Effective values: the student's account wins, then a resubmit's saved snapshot.
  const eff = {
    // Without the Microsoft account's "(Student)" tag.
    full_name: withoutAccountTag(prefill?.fullName ?? profile.full_name),
    student_number: profile.student_number || prefill?.studentNumber || '',
    course: profile.course || prefill?.course || '',
    year_level: profile.year_level ?? prefill?.yearLevel ?? null,
    section: prefill?.section ?? profile.section,
  }
  const baseCourse = enrolled
    ? coursePrefix(enrolled)
    : courses.includes(normalizeCourse(eff.course)) ? normalizeCourse(eff.course) : ''
  const baseYear = eff.year_level ? String(eff.year_level) : enrolledYear ?? ''
  // Locked (read-only, like the full name) when the value comes from the
  // student's account; left editable when the account has nothing saved yet.
  const numberLocked = !!profile.student_number
  const baseCourseLocked = baseCourse !== '' && (!!enrolled || !!profile.course)
  const baseYearLocked = baseYear !== '' && (!!enrolled || !!profile.year_level)

  // Irregular students (back subjects, or a subject taken with another
  // program's section) unlock course / year and see every section of the chosen
  // course. A resubmit whose saved details differ from the account starts
  // unlocked, so the saved values show instead of being replaced by the account's.
  const prefillCourse = prefill?.course && courses.includes(normalizeCourse(prefill.course)) ? normalizeCourse(prefill.course) : ''
  const initialOverride =
    !!prefill && (baseCourseLocked || baseYearLocked) && (
      (prefillCourse !== '' && prefillCourse !== baseCourse) ||
      (prefill.yearLevel != null && String(prefill.yearLevel) !== baseYear) ||
      (!!enrolled && !!prefill.section && prefill.section !== enrolled)
    )
  const initialCourse = initialOverride && prefillCourse ? prefillCourse : baseCourse
  const initialYear = initialOverride && prefill?.yearLevel != null ? String(prefill.yearLevel) : baseYear

  const [override, setOverride] = useState(initialOverride)
  const courseLocked = baseCourseLocked && !override
  const yearLocked = baseYearLocked && !override

  const [examType, setExamType] = useState<'paid' | 'excused'>(prefill?.examType ?? 'paid')
  const [reason, setReason] = useState<'medical' | 'bereavement' | 'other' | ''>(prefill?.excusedReason ?? '')
  const [course, setCourse] = useState(initialCourse)
  const [yearLevel, setYearLevel] = useState(initialYear)
  const [subjectId, setSubjectId] = useState(prefill?.subjectId ?? '')
  const [section, setSection] = useState(initialOverride ? prefill?.section ?? '' : enrolled ?? eff.section ?? '')
  const [confirming, setConfirming] = useState(false)
  // New submissions can include several subjects (each with its own section);
  // a resubmit edits one request, so it keeps the single subject picker.
  const [picked, setPicked] = useState<string[]>([])
  const [pickedSection, setPickedSection] = useState<Record<string, string>>({})
  const [subjectError, setSubjectError] = useState<string | null>(null)
  useErrorToast(subjectError)
  function togglePicked(id: string) {
    setSubjectError(null)
    setPicked((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_SUBJECTS ? cur : [...cur, id])
  }

  function toggleOverride() {
    if (override) {
      // Back to the account's own course / year / section.
      setOverride(false)
      setCourse(baseCourse)
      setYearLevel(baseYear)
      setSubjectId('')
      setSection(enrolled ?? profile.section ?? '')
    } else {
      // The enrolled section may not offer the subject, so the section is re-picked.
      setOverride(true)
      setSection('')
    }
  }

  // A section name like "BSIT 2-201" or "STEM1101" leads with the course /
  // strand code. Comparing that prefix to the chosen course is how "BSIT"
  // students only see BSIT sections (and never SHS ones, etc.) — the class
  // offering data doesn't need a separate department field for this to work.
  // Only offerings whose section matches the chosen course (and, with a mock
  // enrollment, only the student's own section). Nothing shows until a course
  // is picked, so a subject never leaks in from another program.
  const courseOfferings = course
    ? offerings.filter((o) => coursePrefix(o.section) === normalizeCourse(course) && (!enrolled || override || o.section === enrolled))
    : []

  // The year level decides what is offered: only subjects (and their sections)
  // of the chosen year. Irregular-student mode shows every year, and an offering
  // with no year recorded is always kept.
  const yearNum = yearLevel ? Number(yearLevel) : null
  const matchesYear = (o: Offering) => override || yearNum == null || o.yearLevel == null || o.yearLevel === yearNum
  const yearOfferings = courseOfferings.filter(matchesYear)

  const subjectOptions = Array.from(
    new Map(yearOfferings.map((o) => [o.subjectId, { id: o.subjectId, code: o.subjectCode, name: o.subjectName }])).values(),
  )
  // Sections available for the chosen subject.
  const sectionOptions = yearOfferings.filter((o) => o.subjectId === subjectId)
  const teacherName = courseOfferings.find((o) => o.subjectId === subjectId && o.section === section)?.teacherName ?? null

  const formRef = useRef<HTMLFormElement>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  useErrorToast(attachError)
  const closeConfirm = useCallback(() => setConfirming(false), [setConfirming])
  useEscapeKey(closeConfirm, confirming)

  const consentRef = useRef<HTMLInputElement>(null)
  const privacyLinkRef = useRef<HTMLAnchorElement>(null)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const closePrivacy = useCallback(() => {
    setShowPrivacy(false)
    privacyLinkRef.current?.focus()
  }, [setShowPrivacy])

  function openConfirm() {
    if (!submissionOpen) return
    const form = formRef.current
    if (!form) return
    // HTML `required` on <input type="file"> is unreliable on some mobile
    // browsers (a form could submit with no file), so explicitly verify every
    // required file field has a file before opening the confirm dialog. The
    // server re-checks this too, but this gives the student a clear message.
    const fileInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]'))
    const missing = fileInputs.find((i) => i.required && (!i.files || i.files.length === 0))
    if (missing) {
      setAttachError('Please attach all required documents before submitting.')
      missing.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setAttachError(null)
    if (!prefill && picked.length === 0) {
      setSubjectError('Select at least one subject.')
      return
    }
    if (form.reportValidity()) { setConfirming(true); return }
    // The browser's own bubble sits beside the field and is easy to miss on a
    // long form (and on phones), so the same message also pops up bottom-right.
    const bad = form.querySelector<HTMLInputElement>(':invalid')
    const label = bad?.closest('div')?.querySelector('label')?.textContent?.replace(/\s*\*\s*$/, '').trim()
    const message = bad?.validationMessage || 'Please complete the highlighted field.'
    toastError(label && label.length <= 40 ? `${label}: ${message}` : message)
  }

  const docLabel = REASONS.find((r) => r.value === reason)?.doc ?? 'Supporting Document'
  const inputClass =
    'w-full rounded-lg px-3 py-2.5 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)] focus:border-transparent'
  const selectClass = `${inputClass} cursor-pointer`
  const selectStyle = { backgroundColor: 'var(--card)', color: 'var(--card-foreground)' } as React.CSSProperties

  return (
    // Phones and tablets keep the narrow form; on a laptop or desktop it grows
    // so the page isn't a thin column beside empty space.
    <div className="mx-auto max-w-xl lg:max-w-4xl">
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
                className={`cursor-pointer rounded-xl border-2 p-4 transition-colors duration-200 ease-[var(--ease-out)] ${
                  examType === t ? 'border-[var(--sti-gold)] bg-[var(--sti-gold)]/10' : 'ef-border hover:border-[var(--sti-gold)]/50'
                }`}
              >
                <input type="radio" name="exam_type" value={t} checked={examType === t} onChange={() => setExamType(t)} className="sr-only" />
                <Icon name={t === 'paid' ? 'receipt' : 'file'} className="w-6 h-6 mb-2" style={{ color: 'var(--card-foreground)' }} />
                <div className="font-semibold text-sm" style={{ color: 'var(--card-foreground)' }}>
                  {t === 'paid' ? 'Paid' : 'Waived'}
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
                  className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-colors duration-200 ease-[var(--ease-out)] ${
                    reason === r.value ? 'border-[var(--sti-gold)] bg-[var(--sti-gold)]/10' : 'ef-border hover:border-[var(--sti-gold)]/50'
                  }`}
                >
                  <input type="radio" name="excused_reason" value={r.value} required checked={reason === r.value} onChange={() => setReason(r.value)} className="sr-only" />
                  <div className="font-semibold text-sm" style={{ color: 'var(--card-foreground)' }}>{r.label}</div>
                  <div className="text-3xs ef-muted leading-tight mt-0.5">{r.desc}</div>
                </label>
              ))}
            </div>
          </div>
        )}
        {examType === 'excused' && reason === 'other' && (
          <div>
            <label className="block text-sm font-medium ef-muted mb-1">Please specify *</label>
            <input
              name="other_reason"
              required
              maxLength={500}
              // At least one non-space character — `required` alone accepts "   ".
              pattern=".*\S.*"
              title="Please describe the reason — spaces alone are not accepted."
              defaultValue={prefill?.otherReason ?? ''}
              className={inputClass}
              placeholder="Briefly describe the reason"
            />
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
              autoComplete="name"
              value={eff.full_name}
              className={`${inputClass} cursor-not-allowed opacity-70`}
            />
            <p className="mt-1 text-xs ef-muted">Matches your account — contact the Program Head if this is wrong.</p>
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
                autoComplete="tel"
                maxLength={40}
                // Same rule as the server (isValidPhone): the old pattern counted
                // spaces as characters, so blanks or a 10-digit number passed.
                onInput={(e) => e.currentTarget.setCustomValidity(isValidPhone(e.currentTarget.value) ? '' : PHONE_MSG)}
                title={PHONE_MSG}
              />
            </div>
            <div>
              {/* No "(optional)" hint: the number is pre-filled from the
                  student's account (School Data import). */}
              <label className="block text-sm font-medium ef-muted mb-1">
                Student number
              </label>
              <input
                name="student_number"
                readOnly={numberLocked}
                value={numberLocked ? eff.student_number : undefined}
                defaultValue={numberLocked ? undefined : eff.student_number}
                className={numberLocked ? `${inputClass} cursor-not-allowed opacity-70` : inputClass}
                placeholder="2024-00001"
                inputMode="numeric"
                maxLength={40}
                pattern="[0-9-]{4,20}"
                title="Student number should be digits (with optional dashes), e.g. 2024-00001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Course / Program *</label>
              {courseLocked ? (
                <>
                  <input type="hidden" name="course" value={course} />
                  <input
                    readOnly
                    value={courseNames[course] ? `${course} — ${courseNames[course]}` : course}
                    className={`${inputClass} cursor-not-allowed opacity-70`}
                  />
                </>
              ) : (
                <Select
                  name="course"
                  required
                  value={course}
                  onChange={(v) => { setCourse(v); setSubjectId(''); setSection(''); setPicked([]); setPickedSection({}) }}
                  placeholder="— Select course —"
                  options={courses.map((c) => ({ value: c, label: courseNames[c] ? `${c} — ${courseNames[c]}` : c }))}
                  className={selectClass}
                  style={selectStyle}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium ef-muted mb-1">Year level *</label>
              {yearLocked ? (
                <>
                  <input type="hidden" name="year_level" value={yearLevel} />
                  <input
                    readOnly
                    value={`Year ${yearLevel}`}
                    className={`${inputClass} cursor-not-allowed opacity-70`}
                  />
                </>
              ) : (
                <Select
                  name="year_level"
                  required
                  value={yearLevel}
                  onChange={(v) => { setYearLevel(v); setSubjectId(''); setSection(''); setPicked([]); setPickedSection({}) }}
                  placeholder="— Select year —"
                  options={YEARS.map((y) => ({ value: String(y), label: `Year ${y}` }))}
                  className={selectClass}
                  style={selectStyle}
                />
              )}
            </div>
          </div>
          {(baseCourseLocked || baseYearLocked) && (
            <div className="rounded-lg border ef-border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs ef-muted flex-1 min-w-[12rem]">
                {override
                  ? 'Irregular student mode is on — pick the course and year of the subject you are taking. Sections of every year are shown.'
                  : 'Irregular student, or taking a subject outside your own section (e.g. a back subject or another program)?'}
              </p>
              <button
                type="button"
                onClick={toggleOverride}
                aria-pressed={override}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors hover:border-[var(--sti-gold)]/70"
                style={override
                  ? { borderColor: 'var(--sti-gold)', background: 'color-mix(in srgb, var(--sti-gold) 15%, transparent)', color: 'var(--card-foreground)' }
                  : { borderColor: 'var(--border)', color: 'var(--card-foreground)' }}
              >
                {override ? 'Use my own section' : 'My subject is in a different section'}
              </button>
            </div>
          )}
          {(numberLocked || courseLocked || yearLocked) && (
            <p className="text-xs ef-muted">
              Locked fields come from your account. To change them, open My Account from the menu at the top right.
            </p>
          )}
        </div>

        {/* Subject → Section → Teacher (dynamic from the class offerings, scoped to the chosen course) */}
        <div className="space-y-4">
          {/* Header so this block reads as its own group — it previously sat
              unlabeled between "Your Information" and the documents section. */}
          <h2 className="font-semibold text-sm" style={{ color: 'var(--card-foreground)' }}>Exam Details</h2>
          {!prefill ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium ef-muted mb-1">
                  Subjects * <span className="font-normal">(up to {MAX_SUBJECTS})</span>
                </label>
                {!course ? (
                  <p className="text-sm ef-muted">Select a course first.</p>
                ) : subjectOptions.length === 0 ? (
                  <p className="text-sm ef-muted">{yearNum ? `No subjects for Year ${yearNum} yet.` : 'No subjects for that course yet.'}</p>
                ) : (
                  <ul className="rounded-lg border ef-border divide-y max-h-72 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                    {subjectOptions.map((o) => {
                      const on = picked.includes(o.id)
                      const full = !on && picked.length >= MAX_SUBJECTS
                      return (
                        <li key={o.id}>
                          <label className={`flex items-start gap-3 px-3 py-2.5 text-sm ${full ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} style={{ color: 'var(--card-foreground)' }}>
                            <input type="checkbox" checked={on} disabled={full} onChange={() => togglePicked(o.id)} className="mt-0.5 w-4 h-4 accent-[var(--sti-gold)]" />
                            <span>{o.code} — {o.name}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <p className="mt-1 text-xs ef-muted">{picked.length} of {MAX_SUBJECTS} selected</p>
              </div>

              {picked.map((id) => {
                const subj = subjectOptions.find((o) => o.id === id)
                const opts = yearOfferings.filter((o) => o.subjectId === id)
                const chosen = pickedSection[id] ?? (opts.length === 1 ? opts[0].section : '')
                const teacher = opts.find((o) => o.section === chosen)?.teacherName ?? null
                return (
                  <div key={id} className="rounded-lg border ef-border p-3 space-y-2">
                    <input type="hidden" name="subject_id" value={id} />
                    <div className="text-sm font-semibold" style={{ color: 'var(--card-foreground)' }}>{subj ? `${subj.code} — ${subj.name}` : id}</div>
                    <Select
                      name={`section_${id}`}
                      required
                      value={chosen}
                      onChange={(v) => setPickedSection((cur) => ({ ...cur, [id]: v }))}
                      placeholder={opts.length ? '— Select section —' : 'No sections for that subject/year'}
                      options={opts.map((o) => ({ value: o.section, label: o.section }))}
                      className={selectClass}
                      style={selectStyle}
                    />
                    {chosen && (
                      <p className="text-xs ef-muted">Teacher: <strong style={{ color: 'var(--card-foreground)' }}>{teacher ?? 'Not assigned yet'}</strong></p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <>
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

          {subjectId && section && (
            <div className="rounded-lg px-3 py-2 text-sm border ef-border">
              <span className="ef-muted">Teacher: </span>
              <strong style={{ color: 'var(--card-foreground)' }}>{teacherName ?? 'Not assigned yet'}</strong>
              <p className="text-xs ef-muted mt-0.5">Your request will be sent to this section&apos;s teacher for approval.</p>
            </div>
          )}
            </>
          )}
        </div>

        {/* Nothing is uploaded for the parent: their ID and selfie are taken
            live in the verification step after Submit, and the confirm dialog
            tells the student the parent must be present for it. */}

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

        {attachError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
            {attachError}
          </div>
        )}

        {/* Opens the confirmation dialog (does not submit directly) */}
        {/* Data Privacy Act (RA 10173) consent. Parent IDs and medical
            certificates are SENSITIVE personal information, which may only be
            processed with consent given BEFORE processing and specific to the
            purpose — so it lives here, at the point of collection, rather than as
            a blanket tick at sign-up. It also covers the parent, who is a data
            subject but never a user of this system. Enforced on the server too
            (a required checkbox in the browser is trivially bypassed). */}
        {/* The whole block is the tap target. The real checkbox stays in the
            layout (restyled, not hidden) so reportValidity() can still point
            its "please tick this box" bubble at it. Plain section: a hairline
            above, a title, the checkbox and the statement. No tinted box. */}
        <label className="group block cursor-pointer pt-5 border-t ef-border">
          <span className="block text-sm font-semibold mb-3" style={{ color: 'var(--card-foreground)' }}>Data privacy consent</span>
          <span className="flex gap-3 items-start">
            <span className="relative mt-0.5 w-6 h-6 shrink-0">
              <input
                ref={consentRef}
                type="checkbox"
                name="privacy_consent"
                value="yes"
                required
                className="peer block w-6 h-6 m-0 appearance-none cursor-pointer rounded-md border-2 bg-[var(--card)] border-[color-mix(in_srgb,var(--muted)_65%,transparent)] transition-[background-color,border-color,transform] duration-200 ease-[var(--ease-out)] active:scale-90 checked:bg-[var(--sti-gold)] checked:border-[var(--sti-gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sti-gold)] motion-reduce:transition-none"
              />
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 m-auto w-4 h-4 [--check:1] peer-checked:[--check:0]"
                fill="none"
                stroke="var(--sti-navy)"
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  d="M5 12.5 9.5 17 19 7.5"
                  pathLength={1}
                  // The svg is the checkbox's sibling, not this path, so the
                  // checked state reaches the path through --check.
                  className="[stroke-dasharray:1] [stroke-dashoffset:var(--check)] transition-[stroke-dashoffset] duration-300 delay-75 ease-[var(--ease-out)] motion-reduce:transition-none"
                />
              </svg>
            </span>
            <span className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--card-foreground)' }}>
              I confirm that my parent or guardian has authorised this request, and consent to STI
              College Sta. Maria collecting and processing the details and documents above — including
              my parent or guardian&apos;s live ID and face check through Didit, and any medical document — for
              reviewing and scheduling this special exam, as described in the Privacy Notice. I may withdraw consent by
              removing this request while it is pending or rejected.{' '}
              {/* Opens the notice as a pop-up over the form. The href is the
                  fallback if JavaScript hasn't loaded yet. */}
              <a
                ref={privacyLinkRef}
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                aria-haspopup="dialog"
                onClick={(e) => { e.preventDefault(); setShowPrivacy(true) }}
                className="underline underline-offset-2 font-medium"
                style={{ color: 'var(--status-info)' }}
              >
                Read the Privacy Notice
              </a>
            </span>
          </span>
        </label>

        {/* Outside the <label>, so clicks inside the pop-up never toggle the box. */}
        {showPrivacy && (
          <PrivacyNoticeSheet
            onClose={closePrivacy}
            onAgree={() => {
              if (consentRef.current) consentRef.current.checked = true
              setShowPrivacy(false)
              consentRef.current?.focus()
            }}
          />
        )}

        <button
          type="button"
          onClick={openConfirm}
          disabled={!submissionOpen}
          className="w-full py-3 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {/* Not "Submit Request": this button does not submit anything. It saves
              the form and sends the parent to identity verification — the actual
              submission happens after that passes, on the request page. */}
          {submissionOpen ? 'Continue to Parent Verification' : 'Submissions Closed'}
        </button>

        {/* Confirmation dialog — the real submit lives here */}
        {confirming && (
          <div className="ef-overlay fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirming(false)}>
            {/* Plain dialog: title, two short lines, the decision at the bottom right. */}
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-verify-title"
              className="ef-dialog ef-card rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="confirm-verify-title" className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>
                Verify your parent or guardian
              </h3>
              <p className="text-sm mt-2" style={{ color: 'var(--card-foreground)' }}>
                They need to be with you now, with a valid ID, for a quick face and ID check.
              </p>
              <p className="text-sm ef-muted mt-1">
                Your request goes to your Subject Teacher only after this passes.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  style={{ color: 'var(--card-foreground)' }}
                >
                  Go back
                </button>
                <SubmitButton
                  pendingText="Saving…"
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
                >
                  Continue
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
  useErrorToast(fileError)
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
