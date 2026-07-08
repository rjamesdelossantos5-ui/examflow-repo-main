'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { dismissBanner } from './bannerActions'

interface Props {
  termLabel: string | null
  open: boolean
  notStarted: boolean
  daysRemaining: number | null
  windowDays: number
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

/**
 * Top-of-dashboard status card. Three cleanly separated zones instead of the
 * old wall of text: (1) a status header — colored "window" pill + term, with a
 * right-aligned countdown (days left, a depleting progress bar, close date);
 * (2) an amber reminder with a left accent bar; (3) a 3-column exam-schedule
 * strip (Exam period / Venue / Bring). Dismissible for the current login only
 * — it reappears next sign-in (the backing cookie is cleared at login).
 */
export default function SubmissionStatusBanner(props: Props) {
  const [dismissed, setDismissed] = useState(!!props.initiallyDismissed)
  const { open, notStarted, daysRemaining, windowDays, termLabel } = props

  if (dismissed) return null

  const tone = open ? '#16a34a' : notStarted ? '#f59e0b' : '#dc2626'
  const statusText = open ? 'Submission window open' : notStarted ? 'Opens soon' : 'Submissions closed'
  // Depleting bar: share of the window still remaining.
  const remainingPct = open && daysRemaining != null && windowDays > 0
    ? Math.max(4, Math.min(100, (daysRemaining / windowDays) * 100))
    : 0

  const hasTerm = !!termLabel
  const TBA = 'To be announced'
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
    <div className="ef-card rounded-2xl shadow-sm p-5 relative">
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 w-6 h-6 rounded-full grid place-items-center ef-muted hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <Icon name="x" className="w-3.5 h-3.5" />
      </button>

      {/* 1 — Status header */}
      <div className="flex items-start justify-between gap-4 flex-wrap pr-6">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: `color-mix(in srgb, ${tone} 15%, transparent)`, color: tone }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />
            {statusText}
          </span>
          {hasTerm && (
            <span className="font-bold text-base" style={{ color: 'var(--card-foreground)' }}>{termLabel}</span>
          )}
        </div>

        <div className="text-right min-w-[150px]">
          {open && daysRemaining != null ? (
            <>
              <p className="text-sm font-bold" style={{ color: tone }}>
                {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left
              </p>
              <div className="mt-1 h-1.5 w-40 ml-auto rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${remainingPct}%`, background: tone }} />
              </div>
              <p className="text-[11px] ef-muted mt-1">closes {fmtDate(props.end)}</p>
            </>
          ) : notStarted ? (
            <p className="text-sm font-semibold" style={{ color: tone }}>Opens {fmtDate(props.start)}</p>
          ) : (
            <p className="text-sm font-semibold" style={{ color: tone }}>
              {props.end ? `Closed ${fmtDate(props.end)}` : 'Check back later'}
            </p>
          )}
        </div>
      </div>

      {/* 2 — Reminder with left accent bar */}
      <div
        className="mt-4 flex items-start gap-2.5 rounded-r-lg py-2.5 pl-3 pr-3"
        style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', borderLeft: '3px solid #f59e0b' }}
      >
        <Icon name="clock" className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#b45309' }} />
        <p className="text-xs font-medium" style={{ color: 'var(--card-foreground)' }}>
          Get the printed form from the Registrar&apos;s office — submitting here alone does not finish your request.
        </p>
      </div>

      {/* 3 — Exam schedule strip */}
      {hasTerm && (
        <div className="mt-4 grid grid-cols-3 gap-4 border-t ef-border pt-3">
          {[
            { label: 'Exam Period', value: examRange },
            { label: 'Venue', value: props.examLocation || TBA },
            { label: 'Bring', value: props.examBring || TBA },
          ].map((c) => (
            <div key={c.label} className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider ef-muted">{c.label}</p>
              <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: 'var(--card-foreground)' }} title={c.value ?? undefined}>
                {c.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
