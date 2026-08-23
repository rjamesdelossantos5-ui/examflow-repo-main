import type { RequestStatus } from '@/lib/supabase/types'

// Inline progress rail on each student request card. `current` = the stage the
// request is WAITING on (rendered navy); every earlier stage is done (gold
// check); later stages are gray. The final node is only ever "done", never
// current. 'rejected' never renders this — the card shows a resubmit strip.
//
// Paid and excused differ at the end: a paid exam adds a payment sub-flow after
// Program Head acceptance — the student uploads the cashier receipt ("Receipt"),
// then the Program Head verifies it ("Checking") before it's Scheduled. An
// excused exam has no payment, so Program Head acceptance schedules it directly.
const STEPS_EXCUSED = ['Submitted', 'Registrar', 'Teacher', 'Program Head', 'Scheduled'] as const
const STEPS_PAID = ['Submitted', 'Registrar', 'Teacher', 'Program Head', 'Receipt', 'Checking', 'Scheduled'] as const

const CURRENT_EXCUSED: Record<RequestStatus, number> = {
  submitted: 1,
  verified_by_registrar: 2,
  approved_by_teacher: 3,
  accepted: 3,
  receipt_uploaded: 3,
  scheduled: 5, // all five done
  rejected: -1,
}
const CURRENT_PAID: Record<RequestStatus, number> = {
  submitted: 1,
  verified_by_registrar: 2,
  approved_by_teacher: 3,
  accepted: 4, // PH accepted → now waiting on the receipt upload
  receipt_uploaded: 5, // receipt is in → Program Head verifying it
  scheduled: 7, // all seven done
  rejected: -1,
}

export default function RequestStepper({ status, paid }: { status: RequestStatus; paid: boolean }) {
  const STEP_LABELS = paid ? STEPS_PAID : STEPS_EXCUSED
  const current = (paid ? CURRENT_PAID : CURRENT_EXCUSED)[status] ?? 0
  const last = STEP_LABELS.length - 1
  // Gold line reaches up to whichever node is current (or the end when done).
  const fillTo = Math.min(current, last)
  const fillPct = (fillTo / last) * 100

  return (
    <div className="relative">
      {/* base track + gold fill, centered on the 2rem-wide nodes */}
      <div className="absolute left-4 right-4 top-4 h-0.5 -translate-y-1/2" style={{ background: 'var(--border)' }} />
      <div
        className="absolute left-4 top-4 h-0.5 -translate-y-1/2 transition-[width] duration-300 ease-[var(--ease-out)]"
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
                className="text-3xs sm:text-2xs text-center leading-tight"
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
