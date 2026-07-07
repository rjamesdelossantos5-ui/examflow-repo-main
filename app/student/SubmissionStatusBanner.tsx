'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { dismissBanner } from './bannerActions'

interface Props {
  termLabel: string | null
  open: boolean
  notStarted: boolean
  daysRemaining: number | null
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
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * Compact single-line banner at the top of the student dashboard — status +
 * printed-form reminder + exam details all on one row so it doesn't dominate
 * the page. Dismissible — the dismissal only lasts for the current login; it
 * always reappears on the next sign-in (the cookie backing it is cleared at
 * login time).
 */
export default function SubmissionStatusBanner(props: Props) {
  const [dismissed, setDismissed] = useState(!!props.initiallyDismissed)
  const { open, notStarted, daysRemaining, termLabel } = props

  if (dismissed) return null

  const tone = open ? '#16a34a' : notStarted ? '#f59e0b' : '#dc2626'
  const base = open ? 'Submission window is open' : notStarted ? 'Submissions open soon' : 'Submissions are closed'
  const title = termLabel ? `${termLabel} — ${base}` : base
  const headline = open
    ? daysRemaining != null
      ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
      : 'Open'
    : notStarted
      ? `Opens ${fmtDate(props.start)}`
      : props.end
        ? `Closed ${fmtDate(props.end)}`
        : 'Check back later'

  const TBA = 'TBA'
  const hasTerm = !!props.termLabel
  const examRange = props.examDay
    ? props.examEndDay
      ? `${fmtDateTime(props.examDay)} → ${fmtDateTime(props.examEndDay)}`
      : fmtDateTime(props.examDay)
    : hasTerm ? TBA : null

  function handleDismiss() {
    setDismissed(true)
    dismissBanner()
  }

  return (
    <div className="ef-card rounded-xl shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 relative pr-10">
      <span className="inline-flex items-center gap-2">
        <span className="w-7 h-7 rounded-full grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>
          <Icon name="calendar" className="w-4 h-4" />
        </span>
        <span>
          <span className="font-bold text-sm" style={{ color: 'var(--card-foreground)' }}>{title}</span>
          <span className="text-sm font-semibold ml-2" style={{ color: tone }}>{headline}</span>
        </span>
      </span>

      <span className="inline-flex items-center gap-1.5 text-xs ef-muted">
        <Icon name="clock" className="w-3.5 h-3.5 shrink-0" />
        Get the printed form from the <strong style={{ color: 'var(--card-foreground)' }}>Registrar&apos;s office</strong> too — this alone doesn&apos;t finish your request.
      </span>

      {hasTerm && (
        <span className="text-xs ef-muted">
          Exam: <strong style={{ color: 'var(--card-foreground)' }}>{examRange}</strong>
          {' · '}{props.examLocation || TBA}
          {props.examBring ? ` · Bring: ${props.examBring}` : ''}
        </span>
      )}

      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 w-6 h-6 rounded-full grid place-items-center ef-muted hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <Icon name="x" className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
