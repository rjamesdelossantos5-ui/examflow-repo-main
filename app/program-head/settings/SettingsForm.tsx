'use client'

import { useState, useTransition } from 'react'
import { savePeriod, saveExamSchedule, setActivePeriod } from '../actions'
import { computeWindow, TERMS, TERM_LABEL, type ExamPeriod, type Term } from '@/lib/examSettings'

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

export default function SettingsForm({ active, periods }: { active: ExamPeriod | null; periods: ExamPeriod[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Exam Periods</h2>
        <p className="text-sm ef-muted">Each term has its own submission window and one special-exam schedule. Students submit to the active term.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          {error} <button className="underline ml-1" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {active ? (
        <div className="ef-card rounded-xl shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs ef-muted">Active term</p>
            <p className="font-bold" style={{ color: 'var(--card-foreground)' }}>{TERM_LABEL[active.term]}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-700">Active</span>
        </div>
      ) : (
        <div className="ef-card rounded-xl shadow-sm p-4 text-sm ef-muted">No active term — students can&apos;t submit until you set one below.</div>
      )}

      <WindowForm active={active} onError={setError} isPending={isPending} startTransition={startTransition} />
      <ScheduleForm active={active} onError={setError} isPending={isPending} startTransition={startTransition} />

      {periods.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold ef-muted uppercase tracking-wide mb-2">All terms</h3>
          <div className="space-y-2">
            {periods.map((p) => (
              <div key={p.id} className="ef-card rounded-xl shadow-sm p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold" style={{ color: 'var(--card-foreground)' }}>{TERM_LABEL[p.term]}</p>
                  <p className="text-xs ef-muted">
                    Opens {new Date(p.submissionStart + 'T00:00:00').toLocaleDateString()} · {p.windowDays} days
                    {p.examDay ? ` · Exam ${new Date(p.examDay).toLocaleDateString()}` : ''}
                  </p>
                </div>
                {p.isActive ? (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-700">Active</span>
                ) : (
                  <button
                    onClick={() => startTransition(async () => { const res = await setActivePeriod(p.id); if (res.error) setError(res.error) })}
                    disabled={isPending}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold border ef-border disabled:opacity-50"
                    style={{ color: 'var(--card-foreground)' }}
                  >
                    Set active
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
function WindowForm({ active, onError, isPending, startTransition }: FormProps) {
  const [term, setTerm] = useState<Term>(active?.term ?? 'prelim')
  const [start, setStart] = useState(active?.submissionStart ?? '')
  const [days, setDays] = useState(active?.windowDays ?? 7)
  const [saved, setSaved] = useState(false)

  const win = computeWindow(start || null, days)
  const endLabel = win.end ? new Date(win.end).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onError(null); setSaved(false)
    startTransition(async () => {
      const res = await savePeriod({ term, submissionStart: start, windowDays: days })
      if (res.error) onError(res.error)
      else setSaved(true)
    })
  }

  return (
    <form onSubmit={submit} className="ef-card rounded-xl shadow-sm p-6 space-y-5">
      <div>
        <h3 className="font-bold" style={{ color: 'var(--card-foreground)' }}>Submission window</h3>
        <p className="text-sm ef-muted">When students can submit their request for this term.</p>
      </div>
      {saved && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">Window saved and set active.</div>}

      <div>
        <label className={label}>Term *</label>
        <select value={term} onChange={(e) => setTerm(e.target.value as Term)} className={input} style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}>
          {TERMS.map((t) => <option key={t} value={t}>{TERM_LABEL[t]}</option>)}
        </select>
      </div>

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

      <button type="submit" disabled={isPending} className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
        {isPending ? 'Saving…' : 'Save & set active'}
      </button>
    </form>
  )
}

// ── Form 2: special-exam schedule (one per term) ───────────────────────────
function ScheduleForm({ active, onError, isPending, startTransition }: FormProps) {
  const [examStart, setExamStart] = useState(toLocalInput(active?.examDay ?? null))
  const [examEnd, setExamEnd] = useState(toLocalInput(active?.examEndDay ?? null))
  const [location, setLocation] = useState(active?.examLocation ?? '')
  const [bring, setBring] = useState(active?.examBring ?? '')
  const [saved, setSaved] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const alreadySet = !!active?.examDay

  // True when the form still matches the saved schedule exactly (compared at the
  // minute precision the inputs use), so we can tell the PH nothing changed
  // instead of "confirming" a no-op overwrite.
  function unchanged() {
    return (
      examStart === toLocalInput(active?.examDay ?? null) &&
      examEnd === toLocalInput(active?.examEndDay ?? null) &&
      location.trim() === (active?.examLocation ?? '') &&
      bring.trim() === (active?.examBring ?? '')
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onError(null); setSaved(false); setInfo(null)
    if (!active) { onError('Set and activate a submission window first.'); return }
    if (!examStart) { onError('Set the exam date.'); return }
    if (alreadySet && unchanged()) { setInfo('You haven’t changed anything, so there’s nothing to save.'); return }
    setConfirmOpen(true) // in-app confirmation instead of a browser popup
  }

  function doSave() {
    setConfirmOpen(false)
    startTransition(async () => {
      const res = await saveExamSchedule({
        examStart: new Date(examStart + 'T00:00:00').toISOString(),
        examEnd: examEnd ? new Date(examEnd + 'T00:00:00').toISOString() : '',
        examLocation: location,
        examBring: bring,
      })
      if (res.error) onError(res.error)
      else setSaved(true)
    })
  }

  const newStartLabel = examStart ? fmt(new Date(examStart + 'T00:00:00').toISOString()) : '—'
  const newEndLabel = examEnd ? fmt(new Date(examEnd + 'T00:00:00').toISOString()) : null

  return (
    <form onSubmit={submit} className="ef-card rounded-xl shadow-sm p-6 space-y-5">
      <div>
        <h3 className="font-bold" style={{ color: 'var(--card-foreground)' }}>Special exam schedule</h3>
        <p className="text-sm ef-muted">The one date the special exam is held for the active term. Runs over 1–2 days.</p>
      </div>

      {!active && <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">Save a submission window above first.</div>}
      {saved && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">Schedule saved. Students can now see it.</div>}
      {info && <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300">{info}</div>}
      {alreadySet && !saved && (
        <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: 'color-mix(in srgb, var(--sti-gold) 12%, transparent)', color: 'var(--card-foreground)' }}>
          Current: <strong>{fmt(active!.examDay)}</strong>{active!.examEndDay ? <> → <strong>{fmt(active!.examEndDay)}</strong></> : null}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Exam date *</label>
          <input type="date" value={examStart} onChange={(e) => setExamStart(e.target.value)} disabled={!active} className={input} />
        </div>
        <div>
          <label className={label}>Last day (optional, if multi-day)</label>
          <input type="date" value={examEnd} onChange={(e) => setExamEnd(e.target.value)} disabled={!active} className={input} />
        </div>
      </div>

      <div>
        <label className={label}>Exam location</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} disabled={!active} placeholder="e.g. Room 401, Main Building" className={input} />
      </div>
      <div>
        <label className={label}>What to bring</label>
        <textarea value={bring} onChange={(e) => setBring(e.target.value)} disabled={!active} rows={3} placeholder="e.g. Valid ID, blue pen, official receipt…" className={`${input} resize-none`} />
      </div>

      <button type="submit" disabled={isPending || !active} className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
        {isPending ? 'Saving…' : alreadySet ? 'Change schedule' : 'Set schedule'}
      </button>

      {/* In-app confirmation (replaces the browser confirm dialog) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirmOpen(false)}>
          <div className="ef-card rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>
              {alreadySet ? 'Change the exam schedule?' : 'Set the exam schedule?'}
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              {alreadySet && (
                <p className="ef-muted">Current: <span style={{ color: 'var(--card-foreground)' }}>{fmt(active!.examDay)}{active!.examEndDay ? ` → ${fmt(active!.examEndDay)}` : ''}</span></p>
              )}
              <p className="ef-muted">
                New: <strong style={{ color: 'var(--card-foreground)' }}>{newStartLabel}{newEndLabel ? ` → ${newEndLabel}` : ''}</strong>
              </p>
              <p className="ef-muted">{alreadySet ? 'The old schedule will be replaced and students will see the new one right away.' : 'Students will see this right away.'}</p>
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
