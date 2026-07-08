'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { dismissBanner } from './bannerActions'

interface Props {
  termLabel: string | null
  open: boolean
  notStarted: boolean
  start: string | null
  end: string | null
  examDay: string | null
  examEndDay: string | null
  examLocation: string | null
  examBring: string | null
  initiallyDismissed?: boolean
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Compact status strip at the top of the student dashboard. Three tight rows:
 * a status header (colored window pill + term + close date), an amber reminder,
 * and a one-line exam-schedule row. Kept deliberately small so it doesn't eat
 * the top of the page. Dismissible for the current login only (reappears next
 * sign-in — the backing cookie is cleared at login).
 */
export default function SubmissionStatusBanner(props: Props) {
  const [dismissed, setDismissed] = useState(!!props.initiallyDismissed)
  const { open, notStarted, termLabel } = props

  if (dismissed) return null

  const tone = open ? '#16a34a' : notStarted ? '#f59e0b' : '#dc2626'
  const statusText = open ? 'Submission window open' : notStarted ? 'Opens soon' : 'Submissions closed'
  const deadline = open
    ? props.end ? `closes ${fmtDate(props.end)}` : null
    : notStarted ? `opens ${fmtDate(props.start)}`
    : props.end ? `closed ${fmtDate(props.end)}` : null

  const hasTerm = !!termLabel
  const TBA = 'TBA'
  const examRange = props.examDay
    ? props.examEndDay
      ? `${fmtDate(props.examDay)} → ${fmtDate(props.examEndDay)}`
      : fmtDate(props.examDay)
    : hasTerm ? TBA : null

  function handleDismiss() {
    setDismissed(true)
    dismissBanner()
  }

  return (
    <div className="ef-card rounded-xl shadow-sm p-3.5 relative">
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 w-6 h-6 rounded-full grid place-items-center ef-muted hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <Icon name="x" className="w-3.5 h-3.5" />
      </button>

      {/* Status header */}
      <div className="flex items-center gap-2 flex-wrap pr-7">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: `color-mix(in srgb, ${tone} 15%, transparent)`, color: tone }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />
          {statusText}
        </span>
        {hasTerm && <span className="font-bold text-sm" style={{ color: 'var(--card-foreground)' }}>{termLabel}</span>}
        {deadline && <span className="text-xs ef-muted">· {deadline}</span>}
      </div>

      {/* Reminder */}
      <div
        className="mt-2.5 flex items-start gap-2 rounded-r-md py-1.5 pl-2.5 pr-2.5"
        style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', borderLeft: '3px solid #f59e0b' }}
      >
        <Icon name="clock" className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#b45309' }} />
        <p className="text-[11px] font-medium" style={{ color: 'var(--card-foreground)' }}>
          Get the printed form from the Registrar&apos;s office — submitting here alone does not finish your request.
        </p>
      </div>

      {/* Exam schedule — one compact line */}
      {hasTerm && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs border-t ef-border pt-2.5">
          <span><span className="ef-muted">Exam: </span><strong style={{ color: 'var(--card-foreground)' }}>{examRange}</strong></span>
          <span><span className="ef-muted">Venue: </span><strong style={{ color: 'var(--card-foreground)' }}>{props.examLocation || TBA}</strong></span>
          <span><span className="ef-muted">Bring: </span><strong style={{ color: 'var(--card-foreground)' }}>{props.examBring || TBA}</strong></span>
        </div>
      )}
    </div>
  )
}
