'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'

interface Props {
  configured: boolean
  open: boolean
  notStarted: boolean
  daysRemaining: number | null
  start: string | null
  end: string | null
  examDay: string | null
  examLocation: string | null
  examBring: string | null
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * One-time post-login notice for students: shows the submission window status
 * (days remaining), plus the shared exam day / location / what-to-bring. It's
 * remembered per-window in localStorage so it doesn't nag on every visit — a new
 * window (different start/end) shows it again.
 */
export default function SubmissionNotice(props: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!props.configured) return
    const key = `ef-notice-${props.start}-${props.end}`
    if (localStorage.getItem(key) !== 'seen') setShow(true)
  }, [props.configured, props.start, props.end])

  function dismiss() {
    localStorage.setItem(`ef-notice-${props.start}-${props.end}`, 'seen')
    setShow(false)
  }

  if (!show) return null

  const { open, notStarted, daysRemaining } = props
  const tone = open ? '#16a34a' : notStarted ? '#f59e0b' : '#dc2626'
  const title = open ? 'Submission window is open' : notStarted ? 'Submissions open soon' : 'Submissions are closed'
  const headline = open
    ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left to submit`
    : notStarted
      ? `Opens ${fmtDate(props.start)}`
      : `Closed ${fmtDate(props.end)}`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={dismiss}>
      <div className="ef-card rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>
            <Icon name="calendar" className="w-6 h-6" />
          </span>
          <div>
            <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--card-foreground)' }}>{title}</h3>
            <p className="text-sm font-semibold" style={{ color: tone }}>{headline}</p>
          </div>
        </div>

        {open && props.end && (
          <p className="text-sm ef-muted mb-4">Submit your special exam request before <strong style={{ color: 'var(--card-foreground)' }}>{fmtDate(props.end)}</strong>.</p>
        )}

        {(props.examDay || props.examLocation || props.examBring) && (
          <div className="rounded-xl border ef-border p-4 space-y-2 mb-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide ef-muted">Special exam details</p>
            {props.examDay && <p style={{ color: 'var(--card-foreground)' }}><span className="ef-muted">When: </span>{fmtDateTime(props.examDay)}</p>}
            {props.examLocation && <p style={{ color: 'var(--card-foreground)' }}><span className="ef-muted">Where: </span>{props.examLocation}</p>}
            {props.examBring && <p style={{ color: 'var(--card-foreground)' }}><span className="ef-muted">Bring: </span>{props.examBring}</p>}
          </div>
        )}

        <button
          onClick={dismiss}
          className="w-full py-2.5 rounded-lg font-semibold text-sm"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          OK, go to dashboard
        </button>
      </div>
    </div>
  )
}
