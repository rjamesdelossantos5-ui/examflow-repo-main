import type { RequestStatus } from '@/lib/supabase/types'

// Compact 5-step progress rail shown inline on each student request card.
// One unified track for both exam types (the paid receipt step lives inside the
// Program Head stage, so it isn't a separate node here). `current` = the stage
// the request is WAITING on (rendered navy); every earlier stage is done (gold
// check). 'scheduled' = 5 means all five are complete; 'rejected' never renders
// this — the card shows a reject/resubmit strip instead.
const STEP_LABELS = ['Submitted', 'Registrar', 'Teacher', 'Program Head', 'Scheduled'] as const

const CURRENT_INDEX: Record<RequestStatus, number> = {
  submitted: 1,
  verified_by_registrar: 2,
  approved_by_teacher: 3,
  accepted: 3,
  receipt_uploaded: 3,
  scheduled: 5,
  rejected: -1,
}

export default function RequestStepper({ status }: { status: RequestStatus }) {
  const current = CURRENT_INDEX[status] ?? 0
  const last = STEP_LABELS.length - 1
  // Gold line reaches up to whichever node is current (or the end when done).
  const fillTo = Math.min(current, last)
  const fillPct = (fillTo / last) * 100

  return (
    <div className="relative">
      {/* base track + gold fill, centered on the 2rem-wide nodes */}
      <div className="absolute left-4 right-4 top-4 h-0.5 -translate-y-1/2" style={{ background: 'var(--border)' }} />
      <div
        className="absolute left-4 top-4 h-0.5 -translate-y-1/2 transition-all duration-700"
        style={{ width: `calc((100% - 2rem) * ${fillPct / 100})`, background: 'linear-gradient(90deg, #e0a200, var(--sti-gold))' }}
      />

      <div className="relative flex justify-between">
        {STEP_LABELS.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <div key={label} className="flex flex-col items-center gap-1.5 w-14 sm:w-16">
              <div
                className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold"
                style={
                  done
                    ? { background: 'var(--sti-gold)', color: '#fff' }
                    : active
                      ? { background: 'var(--sti-navy)', color: '#fff' }
                      : { background: 'var(--card)', border: '2px solid var(--border)', color: 'var(--muted)' }
                }
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className="text-[10px] sm:text-[11px] text-center leading-tight"
                style={{ color: active ? 'var(--card-foreground)' : 'var(--muted)', fontWeight: active ? 600 : 400 }}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
