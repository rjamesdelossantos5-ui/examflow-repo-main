'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { dismissModal } from './bannerActions'

interface Props {
  termLabel: string | null
  open: boolean
  notStarted: boolean
  daysRemaining: number | null
  start: string | null
  end: string | null
  show: boolean
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

// One-time popup shown right after login. Clicking OK only closes the popup —
// the dashboard banner below stays put and is dismissed separately (via its
// own X). Reappears on the next fresh login (see app/login/actions.ts).
export default function SubmissionStatusModal(props: Props) {
  const [visible, setVisible] = useState(props.show)
  if (!visible) return null

  const { open, notStarted, daysRemaining, termLabel } = props
  const tone = open ? '#16a34a' : notStarted ? '#f59e0b' : '#dc2626'
  const base = open ? 'Submission window is open' : notStarted ? 'Submissions open soon' : 'Submissions are closed'
  const title = termLabel ? `${termLabel} — ${base}` : base
  const headline = open
    ? daysRemaining != null
      ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left to submit`
      : 'Open — no active term set yet'
    : notStarted
      ? `Opens ${fmtDate(props.start)}`
      : props.end
        ? `Closed ${fmtDate(props.end)}`
        : 'Check back later'

  function handleOk() {
    setVisible(false)
    dismissModal()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={handleOk}>
      <div className="ef-card rounded-2xl shadow-xl max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div
          className="mx-auto mb-3 w-14 h-14 rounded-full grid place-items-center"
          style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}
        >
          <Icon name="calendar" className="w-7 h-7" />
        </div>
        <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>{title}</h3>
        <p className="text-sm font-semibold mt-1" style={{ color: tone }}>{headline}</p>
        {open && props.end && (
          <p className="text-xs ef-muted mt-2">Deadline: <strong style={{ color: 'var(--card-foreground)' }}>{fmtDate(props.end)}</strong></p>
        )}
        <button
          onClick={handleOk}
          className="w-full mt-5 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          Okay
        </button>
      </div>
    </div>
  )
}
