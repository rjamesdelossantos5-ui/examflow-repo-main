import { Icon } from '@/components/Icon'

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
 * Persistent banner at the top of the student dashboard — shown on every visit
 * (not a one-time modal) so the student always sees how long is left to submit,
 * the special-exam schedule, and the reminder to collect the printed form.
 */
export default function SubmissionStatusBanner(props: Props) {
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

  // With an active term but no schedule yet, show "To be announced" instead of
  // hiding the row — students still see the exam is coming.
  const TBA = 'To be announced'
  const hasTerm = !!props.termLabel
  const examRange = props.examDay
    ? props.examEndDay
      ? `${fmtDateTime(props.examDay)} → ${fmtDateTime(props.examEndDay)}`
      : fmtDateTime(props.examDay)
    : hasTerm ? TBA : null

  return (
    <div className="ef-card rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b ef-border">
        <span className="w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>
          <Icon name="calendar" className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <h3 className="font-bold leading-tight" style={{ color: 'var(--card-foreground)' }}>{title}</h3>
          <p className="text-sm font-semibold" style={{ color: tone }}>{headline}</p>
        </div>
        {open && props.end && (
          <span className="ml-auto hidden sm:block text-xs ef-muted text-right">Deadline<br /><strong style={{ color: 'var(--card-foreground)' }}>{fmtDate(props.end)}</strong></span>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* School-standard reminder, made prominent — the online request is only
            step one; the printed form from the Registrar is required. */}
        <div className="rounded-xl px-4 py-3.5" style={{ background: 'color-mix(in srgb, #f59e0b 16%, transparent)', border: '1px solid rgba(245,158,11,0.45)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="clock" className="w-5 h-5 shrink-0" style={{ color: '#b45309' }} />
            <p className="font-bold text-sm" style={{ color: '#92400e' }}>Don&apos;t forget the printed form</p>
          </div>
          <p className="text-sm" style={{ color: 'var(--card-foreground)' }}>
            Submitting here does <strong>not</strong> finish your request. You still need to get the printed special-exam form from the <strong>Registrar&apos;s office</strong> and fill it out to complete the process.
          </p>
        </div>

        {hasTerm && (
          <div className="rounded-xl border ef-border p-4 space-y-1.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide ef-muted mb-1">Special exam details</p>
            <p style={{ color: 'var(--card-foreground)' }}><span className="ef-muted">When: </span>{examRange}</p>
            <p style={{ color: 'var(--card-foreground)' }}><span className="ef-muted">Where: </span>{props.examLocation || TBA}</p>
            <p style={{ color: 'var(--card-foreground)' }}><span className="ef-muted">Bring: </span>{props.examBring || TBA}</p>
          </div>
        )}
      </div>
    </div>
  )
}
