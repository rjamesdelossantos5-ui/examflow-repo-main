'use client'

import { useCallback, useState } from 'react'
import { Icon } from '@/components/Icon'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { ackSchedule } from './bannerActions'

interface Props {
  show: boolean
  signature: string
  termLabel: string | null
  examDay: string
  examEndDay: string | null
  examLocation: string | null
  examBring: string | null
  /** Fired after the popup is acknowledged, so a following popup (the
   *  submission-window one) can appear immediately instead of on next refresh. */
  onClose?: () => void
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

// One-time popup for "the Program Head just set/changed the exam schedule".
// Acknowledging it persists in the DB (schedule_ack), not a cookie — it stays
// dismissed across logins and only reappears if the schedule changes again.
export default function ScheduleAnnouncementModal(props: Props) {
  const [visible, setVisible] = useState(props.show)

  // Escape acknowledges the announcement exactly like the Okay button does.
  const { signature, onClose } = props
  const handleOk = useCallback(() => {
    setVisible(false)
    ackSchedule(signature)
    onClose?.()
  }, [signature, onClose])
  useEscapeKey(handleOk, visible)

  if (!visible) return null

  const examRange = props.examEndDay
    ? `${fmtDate(props.examDay)} → ${fmtDate(props.examEndDay)}`
    : fmtDate(props.examDay)

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={handleOk}>
      <div className="ef-card rounded-2xl shadow-xl max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 w-14 h-14 rounded-full grid place-items-center" style={{ background: 'color-mix(in srgb, var(--status-success) 16%, transparent)', color: 'var(--status-success)' }}>
          <Icon name="calendar" className="w-7 h-7" />
        </div>
        <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>
          {props.termLabel ? `${props.termLabel} exam is scheduled` : 'Exam is scheduled'}
        </h3>
        <p className="text-sm font-semibold mt-1" style={{ color: 'var(--status-success)' }}>{examRange}</p>
        {(props.examLocation || props.examBring) && (
          <div className="mt-3 text-sm text-left rounded-lg border ef-border p-3 space-y-1">
            {props.examLocation && <p><span className="ef-muted">Where: </span><span style={{ color: 'var(--card-foreground)' }}>{props.examLocation}</span></p>}
            {props.examBring && <p><span className="ef-muted">Bring: </span><span style={{ color: 'var(--card-foreground)' }}>{props.examBring}</span></p>}
          </div>
        )}
        <p className="text-xs ef-muted mt-3">
          Please ask the Registrar or your Program Head for further assistance.
        </p>
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
