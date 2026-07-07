import { Icon } from '@/components/Icon'

interface Props {
  termLabel: string | null
  open: boolean
  notStarted: boolean
  daysRemaining: number | null
  end: string | null // submission window end (ISO)
}

function fmt(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Compact banner for the Registrar and Teacher queues so they can see the
 * submission window at a glance — i.e. how much time is left to process the
 * remaining forms. The special-exam date/location is a Program Head concern,
 * not shown here.
 */
export default function StaffWindowBanner(props: Props) {
  const { open, notStarted, daysRemaining, termLabel } = props
  if (!termLabel) {
    return (
      <div className="ef-card rounded-xl shadow-sm px-4 py-3 mb-5 text-sm ef-muted flex items-center gap-2">
        <Icon name="calendar" className="w-4 h-4" /> No active term set by the Program Head yet.
      </div>
    )
  }
  const tone = open ? '#16a34a' : notStarted ? '#f59e0b' : '#dc2626'
  const state = open
    ? `Submissions open · ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left${props.end ? ` (closes ${fmt(props.end)})` : ''}`
    : notStarted
      ? 'Submissions not yet open'
      : 'Submissions closed'

  return (
    <div className="ef-card rounded-xl shadow-sm px-4 py-3 mb-5 flex flex-wrap items-center gap-x-6 gap-y-1.5">
      <span className="inline-flex items-center gap-2">
        <span className="w-8 h-8 rounded-full grid place-items-center shrink-0" style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>
          <Icon name="calendar" className="w-4 h-4" />
        </span>
        <span>
          <span className="font-bold" style={{ color: 'var(--card-foreground)' }}>{termLabel}</span>
          <span className="text-sm ml-2" style={{ color: tone }}>{state}</span>
        </span>
      </span>
    </div>
  )
}
