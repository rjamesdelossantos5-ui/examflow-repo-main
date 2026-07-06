'use client'

import { useState, useTransition } from 'react'
import { savePeriod, setActivePeriod } from '../actions'
import { computeWindow, TERMS, TERM_LABEL, type ExamPeriod, type Term } from '@/lib/examSettings'

export default function SettingsForm({ active, periods }: { active: ExamPeriod | null; periods: ExamPeriod[] }) {
  const [term, setTerm] = useState<Term>(active?.term ?? 'prelim')
  const [schoolYear, setSchoolYear] = useState(active?.schoolYear ?? '')
  const [start, setStart] = useState(active?.submissionStart ?? '')
  const [days, setDays] = useState(active?.windowDays ?? 7)
  const [examDay, setExamDay] = useState(active?.examDay ? active.examDay.slice(0, 16) : '')
  const [location, setLocation] = useState(active?.examLocation ?? '')
  const [bring, setBring] = useState(active?.examBring ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const win = computeWindow(start || null, days)
  const endLabel = win.end ? new Date(win.end).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(false)
    startTransition(async () => {
      const res = await savePeriod({
        term, schoolYear, submissionStart: start, windowDays: days,
        examDay: examDay ? new Date(examDay).toISOString() : '',
        examLocation: location, examBring: bring,
      })
      if (res.error) setError(res.error)
      else setSuccess(true)
    })
  }

  function activate(id: string) {
    startTransition(async () => {
      const res = await setActivePeriod(id)
      if (res.error) setError(res.error)
    })
  }

  const input = 'w-full rounded-lg px-3 py-2.5 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]'
  const label = 'block text-sm font-medium ef-muted mb-1'

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Exam Periods</h2>
        <p className="text-sm ef-muted">Each term keeps its own submission window and exam details. Students submit to the active period.</p>
      </div>

      {active ? (
        <div className="ef-card rounded-xl shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs ef-muted">Active period</p>
            <p className="font-bold" style={{ color: 'var(--card-foreground)' }}>{TERM_LABEL[active.term]} {active.schoolYear}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-700">Active</span>
        </div>
      ) : (
        <div className="ef-card rounded-xl shadow-sm p-4 text-sm ef-muted">No active period — students can&apos;t submit until you set one.</div>
      )}

      <form onSubmit={handleSubmit} className="ef-card rounded-xl shadow-sm p-6 space-y-5">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">{error}</div>}
        {success && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">Period saved and set active.</div>}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Term *</label>
            <select value={term} onChange={(e) => setTerm(e.target.value as Term)} className={input} style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}>
              {TERMS.map((t) => <option key={t} value={t}>{TERM_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>School year</label>
            <input type="text" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} placeholder="2025–2026" className={input} />
          </div>
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

        <hr className="ef-border" />

        <div>
          <label className={label}>Date &amp; time of special exam</label>
          <input type="datetime-local" value={examDay} onChange={(e) => setExamDay(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label}>Exam location</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Room 401, Main Building" className={input} />
        </div>
        <div>
          <label className={label}>What to bring</label>
          <textarea value={bring} onChange={(e) => setBring(e.target.value)} rows={3} placeholder="e.g. Valid ID, blue pen, official receipt…" className={`${input} resize-none`} />
        </div>

        <button type="submit" disabled={isPending} className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
          {isPending ? 'Saving…' : 'Save & set active'}
        </button>
      </form>

      {periods.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold ef-muted uppercase tracking-wide mb-2">All periods</h3>
          <div className="space-y-2">
            {periods.map((p) => (
              <div key={p.id} className="ef-card rounded-xl shadow-sm p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold" style={{ color: 'var(--card-foreground)' }}>{TERM_LABEL[p.term]} {p.schoolYear}</p>
                  <p className="text-xs ef-muted">Opens {new Date(p.submissionStart + 'T00:00:00').toLocaleDateString()} · {p.windowDays} days</p>
                </div>
                {p.isActive ? (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-700">Active</span>
                ) : (
                  <button onClick={() => activate(p.id)} disabled={isPending} className="text-xs px-3 py-1.5 rounded-lg font-semibold border ef-border disabled:opacity-50" style={{ color: 'var(--card-foreground)' }}>
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
