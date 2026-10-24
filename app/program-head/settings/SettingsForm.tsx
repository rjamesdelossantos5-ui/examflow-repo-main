'use client'

import { useErrorToast, toastSuccess } from '@/components/Toaster'
import { useCallback, useState, useTransition } from 'react'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { savePeriod, saveExamSchedule } from '../actions'
import { computeWindow, TERMS, TERM_LABEL, SEMESTERS, SEMESTER_LABEL, type ExamPeriod, type Term, type Semester } from '@/lib/examSettings'
import Select from '@/components/Select'

const input = 'w-full rounded-lg px-3 py-2.5 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]'
const label = 'block text-sm font-medium ef-muted mb-1'

function fmt(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
// <input type="date"> wants 'yyyy-MM-dd' in LOCAL time.
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// <input type="time"> wants 'HH:mm' in LOCAL time. Midnight means "no time was
// set" (every schedule saved before times existed is midnight), so it reads blank.
function toLocalTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (d.getHours() === 0 && d.getMinutes() === 0) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// A local date ('yyyy-MM-dd') and an optional time ('HH:mm') as one Date.
function combine(date: string, time: string) {
  return new Date(`${date}T${time || '00:00'}:00`)
}
// "Oct 23, 2026" or, when a time was set, "Oct 23, 2026, 8:00 AM".
function fmtWhen(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  const date = fmt(iso)
  if (d.getHours() === 0 && d.getMinutes() === 0) return date
  return `${date}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

// 'Opens 3 Nov 2025 · 7 days', or a plain statement when the term is current
// but has no window yet. Never build this by concatenating submissionStart
// directly: it is nullable, and TypeScript permits (string | null) + string,
// so a null slips through the compiler and renders as 'Invalid Date'.
function windowSummary(p: { submissionStart: string | null; windowDays: number }): string {
  if (!p.submissionStart) return 'No submission window set'
  return `Opens ${new Date(p.submissionStart + 'T00:00:00').toLocaleDateString()} · ${p.windowDays} days`
}

export default function SettingsForm({ active, periods }: { active: ExamPeriod | null; periods: ExamPeriod[] }) {
  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)
  const [isPending, startTransition] = useTransition()

  // The special exam in one phrase for the status strip.
  const examSummary = active?.examDay
    ? `${fmtWhen(active.examDay)}${active.examEndDay ? ` to ${fmtWhen(active.examEndDay)}` : ''}${active.examLocation ? `, ${active.examLocation}` : ''}`
    : 'Not scheduled yet'

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Exam Periods</h2>
        <p className="text-sm ef-muted">Each term has its own submission window and one special-exam schedule. Students submit to the active term.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* The whole current setup at a glance, full width. */}
      {active ? (
        <div className="ef-card rounded-xl shadow-sm px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'color-mix(in srgb, var(--status-success) 14%, transparent)', color: 'var(--status-success)' }}>
                Active
              </span>
              <p className="font-bold" style={{ color: 'var(--card-foreground)' }}>{SEMESTER_LABEL[active.semester]} · {TERM_LABEL[active.term]}</p>
            </div>
            <p className="text-sm">
              <span className="ef-muted">Submissions: </span>
              <span style={{ color: 'var(--card-foreground)' }}>{windowSummary(active)}</span>
            </p>
            <p className="text-sm">
              <span className="ef-muted">Special exam: </span>
              <span style={{ color: 'var(--card-foreground)' }}>{examSummary}</span>
            </p>
          </div>
          {/* The cost of letting a term exist without a window: it can be
              forgotten. Nothing else tells the PH submissions are shut. */}
          {!active.submissionStart && (
            <p className="mt-3 pt-3 border-t ef-border text-sm" style={{ color: 'var(--status-warning)' }}>
              <strong>Students can&apos;t submit yet.</strong> {SEMESTER_LABEL[active.semester]} · {TERM_LABEL[active.term]} is the current term, but no submission window is set. Add the start date below once you have it.
            </p>
          )}
        </div>
      ) : (
        <div className="ef-card rounded-xl shadow-sm px-5 py-4 text-sm" style={{ color: 'var(--status-warning)' }}>
          No active term. Students can&apos;t submit until you set one below.
        </div>
      )}

      {/* The two forms side by side on wide screens; stacked on phones. */}
      <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        <WindowForm active={active} periods={periods} onError={setError} isPending={isPending} startTransition={startTransition} />
        <ScheduleForm active={active} onError={setError} isPending={isPending} startTransition={startTransition} />
      </div>
    </div>
  )
}

type FormProps = {
  active: ExamPeriod | null
  onError: (e: string | null) => void
  isPending: boolean
  startTransition: (cb: () => void) => void
}

// ── Form 1: submission window ──────────────────────────────────────────────
function WindowForm({ active, periods, onError, isPending, startTransition }: FormProps & { periods: ExamPeriod[] }) {
  const [term, setTerm] = useState<Term>(active?.term ?? 'prelim')
  const [semester, setSemester] = useState<Semester>(active?.semester ?? '1st')
  const [start, setStart] = useState(active?.submissionStart ?? '')
  const [days, setDays] = useState(active?.windowDays ?? 7)
  // Setting the dates is the common case, so this starts on; the PH turns it
  // off for the one case it exists for — naming the current term before the
  // special-exam dates have been announced.
  const [withWindow, setWithWindow] = useState(true)
  const [saved, setSaved] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  useEscapeKey(closeConfirm, confirmOpen)

  // The saved period for whichever semester + term is currently selected (not
  // necessarily the active one — the PH can set up a future term here).
  const existing = periods.find((p) => p.term === term && p.semester === semester) ?? null
  const alreadySet = !!existing

  // One value decides what gets saved, what the dialog says and what the
  // button reads, so the toggle and the date field can never disagree.
  const effectiveStart = withWindow ? start : ''

  function unchanged() {
    return (
      !!existing &&
      (effectiveStart || null) === existing.submissionStart &&
      days === existing.windowDays &&
      existing.isActive
    )
  }

  const win = computeWindow(effectiveStart || null, days)
  const endLabel = win.end ? new Date(win.end).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onError(null); setSaved(false); setInfo(null)
    if (withWindow && !start) { onError('Set a submission start date, or turn off “Open the submission window now”.'); return }
    if (unchanged()) { setInfo('You haven’t changed anything, so there’s nothing to save.'); return }
    setConfirmOpen(true) // in-app confirmation instead of a browser popup
  }

  function doSave() {
    setConfirmOpen(false)
    startTransition(async () => {
      const res = await savePeriod({ term, semester, submissionStart: effectiveStart, windowDays: days })
      if (res.error) onError(res.error)
      else { setSaved(true); toastSuccess('Submission window saved') }
    })
  }

  return (
    <form onSubmit={submit} className="ef-card rounded-xl shadow-sm p-6 space-y-5 flex flex-col">
      <div>
        <h3 className="font-bold" style={{ color: 'var(--card-foreground)' }}>Current term &amp; submission window</h3>
        <p className="text-sm ef-muted">Which term the school is processing special exams for, and when students can submit. Leave the date blank to set the term now and add the window later.</p>
      </div>
      {saved && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">{effectiveStart ? 'Window saved and set active.' : 'Term set as current. Submissions stay closed until you add a start date.'}</div>}
      {info && <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300">{info}</div>}
      {/* What is already saved for the semester + term picked below, which
          may be a future term rather than the active one. */}
      {existing && !saved && (
        <p className="text-sm ef-muted">
          Saved for this term: <span className="font-semibold" style={{ color: 'var(--card-foreground)' }}>{windowSummary(existing)}</span>
          {existing.isActive ? '' : ' (not the current term)'}
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Semester *</label>
          <Select
            value={semester}
            onChange={(v) => setSemester(v as Semester)}
            options={SEMESTERS.map((s) => ({ value: s, label: SEMESTER_LABEL[s] }))}
            className={input}
            style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
          />
        </div>
        <div>
          <label className={label}>Term *</label>
          <Select
            value={term}
            onChange={(v) => setTerm(v as Term)}
            options={TERMS.map((t) => ({ value: t, label: TERM_LABEL[t] }))}
            className={input}
            style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
          />
        </div>
      </div>

      {/* The dates are hidden rather than just optional, so "name the current
          term" does not look like a half-filled form. On by default: setting
          the window is the normal case, and the blank-date state exists only
          for a term whose dates have not been announced. */}
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={withWindow}
          onChange={(e) => setWithWindow(e.target.checked)}
          className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--sti-gold)] cursor-pointer"
        />
        <span className="text-sm" style={{ color: 'var(--card-foreground)' }}>
          Open the submission window now
          <span className="block text-xs ef-muted">Turn this off to name the current term and add the dates later.</span>
        </span>
      </label>

      {withWindow ? (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Submission start date *</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required className={input} />
            </div>
            <div>
              <label className={label}>Open for (days) *</label>
              <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} required className={input} />
            </div>
          </div>

          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--sti-gold) 12%, transparent)', color: 'var(--card-foreground)' }}>
            {start ? <>Submissions close on <strong>{endLabel}</strong> ({days} day{days !== 1 ? 's' : ''}).</> : <>Set a start date to compute the closing date.</>}
          </div>
        </>
      ) : (
        <div className="rounded-lg px-4 py-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
          {SEMESTER_LABEL[semester]} · {TERM_LABEL[term]} becomes the current term and <strong>submissions stay closed</strong> until you come back and set the dates.
        </div>
      )}

      <button type="submit" disabled={isPending} className="mt-auto px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 self-start" style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
        {isPending ? 'Saving…' : effectiveStart ? (alreadySet ? 'Change window' : 'Save & set active') : 'Set as current term'}
      </button>

      {/* In-app confirmation (replaces the browser confirm dialog) */}
      {confirmOpen && (
        <div className="ef-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirmOpen(false)}>
          <div className="ef-dialog ef-card rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>
              {!effectiveStart ? 'Set as the current term?' : alreadySet ? 'Change the submission window?' : 'Set the submission window?'}
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              {existing && (
                <p className="ef-muted">Current: <span style={{ color: 'var(--card-foreground)' }}>{windowSummary(existing)}</span></p>
              )}
              <p className="ef-muted">
                New: <strong style={{ color: 'var(--card-foreground)' }}>{effectiveStart ? `Opens ${new Date(effectiveStart + 'T00:00:00').toLocaleDateString()} · ${days} days (closes ${endLabel})` : 'Current term only — no submission window'}</strong>
              </p>
              {/* Saving blank over a saved window CLEARS it — the upsert writes
                  submission_start: null. Never let that happen silently. */}
              {existing?.submissionStart && !effectiveStart && (
                <p className="rounded-md px-3 py-2 text-xs bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
                  This <strong>clears</strong> the window already saved for this term ({windowSummary(existing)}). Students won&apos;t be able to submit until you set a new one.
                </p>
              )}
              <p className="ef-muted">This makes {SEMESTER_LABEL[semester]} · {TERM_LABEL[term]} the active term — students will see it right away.</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border" style={{ color: 'var(--card-foreground)' }}>Cancel</button>
              <button type="button" onClick={doSave} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
                {!effectiveStart ? 'Yes, set the term' : alreadySet ? 'Yes, change it' : 'Yes, set it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

// ── Form 2: special-exam schedule (one per term) ───────────────────────────
function ScheduleForm({ active, onError, isPending, startTransition }: FormProps) {
  const [examStart, setExamStart] = useState(toLocalInput(active?.examDay ?? null))
  const [examEnd, setExamEnd] = useState(toLocalInput(active?.examEndDay ?? null))
  const [startTime, setStartTime] = useState(toLocalTime(active?.examDay ?? null))
  const [endTime, setEndTime] = useState(toLocalTime(active?.examEndDay ?? null))
  const [location, setLocation] = useState(active?.examLocation ?? '')
  const [bring, setBring] = useState(active?.examBring ?? '')
  const [saved, setSaved] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  useEscapeKey(closeConfirm, confirmOpen)

  const alreadySet = !!active?.examDay

  // True when the form still matches the saved schedule exactly (compared at the
  // minute precision the inputs use), so we can tell the PH nothing changed
  // instead of "confirming" a no-op overwrite.
  function unchanged() {
    return (
      examStart === toLocalInput(active?.examDay ?? null) &&
      endDate === toLocalInput(active?.examEndDay ?? null) &&
      startTime === toLocalTime(active?.examDay ?? null) &&
      endTime === toLocalTime(active?.examEndDay ?? null) &&
      location.trim() === (active?.examLocation ?? '') &&
      bring.trim() === (active?.examBring ?? '')
    )
  }

  // Today in the PH's local time (yyyy-MM-dd) — the earliest allowed exam date.
  // A date in the past means the exam has already happened.
  const todayStr = toLocalInput(new Date().toISOString())

  // A closing time with no last day means the exam ends that same day.
  const endDate = examEnd || (endTime ? examStart : '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onError(null); setSaved(false); setInfo(null)
    if (!active) { onError('Set and activate a submission window first.'); return }
    if (!examStart) { onError('Set the exam date.'); return }
    if (examStart < todayStr) { onError('The exam date can’t be in the past.'); return }
    if (examEnd && examEnd < todayStr) { onError('The last exam day can’t be in the past.'); return }
    if (startTime && combine(examStart, startTime) < new Date()) { onError('The exam start time can’t be in the past.'); return }
    if (endDate && combine(endDate, endTime).getTime() < combine(examStart, startTime).getTime()) { onError('The exam must end after it starts.'); return }
    if (alreadySet && unchanged()) { setInfo('You haven’t changed anything, so there’s nothing to save.'); return }
    setConfirmOpen(true) // in-app confirmation instead of a browser popup
  }

  function doSave() {
    setConfirmOpen(false)
    startTransition(async () => {
      const res = await saveExamSchedule({
        examStart: combine(examStart, startTime).toISOString(),
        examEnd: endDate ? combine(endDate, endTime).toISOString() : '',
        examLocation: location,
        examBring: bring,
      })
      if (res.error) onError(res.error)
      else { setSaved(true); toastSuccess('Exam schedule saved') }
    })
  }

  const newStartLabel = examStart ? fmtWhen(combine(examStart, startTime).toISOString()) : '—'
  const newEndLabel = endDate ? fmtWhen(combine(endDate, endTime).toISOString()) : null

  // Non-blocking sanity check: the exam should fall AFTER submissions close.
  // If it's on or before the window's close day, students can keep filing
  // requests for an exam that's already happened (and those late forms can't be
  // reviewed in time). We warn the PH but never block — they may have a reason.
  const windowEnd = active ? computeWindow(active.submissionStart, active.windowDays).end : null
  const examStartDate = examStart ? new Date(examStart + 'T00:00:00') : null
  const scheduleWarning =
    windowEnd && examStartDate && examStartDate <= new Date(windowEnd)
      ? `The exam date (${newStartLabel}) is on or before submissions close (${fmt(windowEnd)}). It’s recommended to set the exam date after the submission window ends, so every request can be reviewed in time — otherwise students may keep filing requests that can’t be processed before the exam.`
      : null

  return (
    <form onSubmit={submit} className="ef-card rounded-xl shadow-sm p-6 space-y-5 flex flex-col">
      <div>
        <h3 className="font-bold" style={{ color: 'var(--card-foreground)' }}>Special exam schedule</h3>
        <p className="text-sm ef-muted">The one date the special exam is held for the active term. Runs over 1–2 days.</p>
      </div>

      {!active && <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">Save a submission window above first.</div>}
      {saved && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">Schedule saved. Students can now see it.</div>}
      {info && <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300">{info}</div>}
      {alreadySet && !saved && (
        <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: 'color-mix(in srgb, var(--sti-gold) 12%, transparent)', color: 'var(--card-foreground)' }}>
          Current: <strong>{fmtWhen(active!.examDay)}</strong>{active!.examEndDay ? <> → <strong>{fmtWhen(active!.examEndDay)}</strong></> : null}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Exam date *</label>
          <input type="date" value={examStart} min={todayStr} onChange={(e) => setExamStart(e.target.value)} disabled={!active} className={input} />
        </div>
        <div>
          <label className={label}>Last day (optional, if multi-day)</label>
          <input type="date" value={examEnd} min={examStart || todayStr} onChange={(e) => setExamEnd(e.target.value)} disabled={!active} className={input} />
        </div>
        <div>
          <label className={label}>Start time (optional)</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!active} className={input} />
        </div>
        <div>
          <label className={label}>End time (optional)</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!active} className={input} />
        </div>
      </div>

      {scheduleWarning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
          ⚠️ {scheduleWarning} You can still save it.
        </div>
      )}

      <div>
        <label className={label}>Exam location</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} disabled={!active} placeholder="e.g. Room 401, Main Building" className={input} />
      </div>
      <div>
        <label className={label}>What to bring</label>
        <textarea value={bring} onChange={(e) => setBring(e.target.value)} disabled={!active} rows={3} placeholder="e.g. Valid ID, blue pen, official receipt…" className={`${input} resize-none`} />
      </div>

      <button type="submit" disabled={isPending || !active} className="mt-auto px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 self-start" style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
        {isPending ? 'Saving…' : alreadySet ? 'Change schedule' : 'Set schedule'}
      </button>

      {/* In-app confirmation (replaces the browser confirm dialog) */}
      {confirmOpen && (
        <div className="ef-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirmOpen(false)}>
          <div className="ef-dialog ef-card rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>
              {alreadySet ? 'Change the exam schedule?' : 'Set the exam schedule?'}
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              {alreadySet && (
                <p className="ef-muted">Current: <span style={{ color: 'var(--card-foreground)' }}>{fmtWhen(active!.examDay)}{active!.examEndDay ? ` → ${fmtWhen(active!.examEndDay)}` : ''}</span></p>
              )}
              <p className="ef-muted">
                New: <strong style={{ color: 'var(--card-foreground)' }}>{newStartLabel}{newEndLabel ? ` → ${newEndLabel}` : ''}</strong>
              </p>
              <p className="ef-muted">{alreadySet ? 'The old schedule will be replaced and students will see the new one right away.' : 'Students will see this right away.'}</p>
              {scheduleWarning && (
                <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                  ⚠️ {scheduleWarning}
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border" style={{ color: 'var(--card-foreground)' }}>Cancel</button>
              <button type="button" onClick={doSave} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
                {alreadySet ? 'Yes, change it' : 'Yes, set it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
