'use client'

import { useState, useTransition } from 'react'
import { updateExamSettings } from '../actions'
import { computeWindow, type ExamSettings } from '@/lib/examSettings'

export default function SettingsForm({ settings }: { settings: ExamSettings }) {
  const [start, setStart] = useState(settings.submissionStart ?? '')
  const [days, setDays] = useState(settings.windowDays)
  const [examDay, setExamDay] = useState(settings.examDay ? settings.examDay.slice(0, 16) : '')
  const [location, setLocation] = useState(settings.examLocation ?? '')
  const [bring, setBring] = useState(settings.examBring ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Live-computed closing date from start + days (e.g. Aug 1 + 7 days → Aug 7).
  const win = computeWindow(start || null, days)
  const endLabel = win.end ? new Date(win.end).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const res = await updateExamSettings({
        submissionStart: start,
        windowDays: days,
        examDay: examDay ? new Date(examDay).toISOString() : '',
        examLocation: location,
        examBring: bring,
      })
      if (res.error) setError(res.error)
      else setSuccess(true)
    })
  }

  const input = 'w-full rounded-lg px-3 py-2.5 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]'
  const label = 'block text-sm font-medium ef-muted mb-1'

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Submission Timeframe & Exam Details</h2>
      <p className="text-sm ef-muted mb-6">
        Set when students may submit requests, and the shared details for the special exam.
      </p>

      <div className="ef-card rounded-xl shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">{error}</div>}
          {success && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">Settings saved.</div>}

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

          {/* Auto-computed closing date */}
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--sti-gold) 12%, transparent)', color: 'var(--card-foreground)' }}>
            {start
              ? <>Submissions close on <strong>{endLabel}</strong> ({days} day{days !== 1 ? 's' : ''} from the start date).</>
              : <>Set a start date to compute the closing date.</>}
          </div>

          <hr className="ef-border" />

          <div>
            <label className={label}>Date & time of special exam</label>
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

          <button type="submit" disabled={isPending}
            className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
            {isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
