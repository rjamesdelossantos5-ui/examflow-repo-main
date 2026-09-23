import type { RequestStatus } from '@/lib/supabase/types'

// Inline progress rail on each student request card. `current` = the stage the
// request is WAITING on (rendered navy); every earlier stage is done (gold
// check); later stages are gray. The final node is only ever "done", never
// current. 'rejected' never renders this — the card shows a resubmit strip.
//
// Paid and excused differ at the end: a paid exam adds a payment sub-flow after
// Program Head acceptance — the Registrar totals the student's special-exam
// subjects and passes the amount to the Cashier ("Fee Assessment", their second
// touch of the request), the student uploads the cashier receipt ("Receipt"),
// then the Program Head verifies it ("Checking") before it's Scheduled. An
// excused exam has no payment, so Program Head acceptance schedules it directly.
const STEPS_EXCUSED = ['Submitted', 'Registrar', 'Teacher', 'Program Head', 'Scheduled'] as const
const STEPS_PAID = ['Submitted', 'Registrar', 'Teacher', 'Program Head', 'Fee Assessment', 'Receipt', 'Checking', 'Scheduled'] as const

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
  // PH accepted → now waiting on the Registrar's fee assessment. Once they've
  // assessed it, `assessed` below advances this one node to the Receipt step.
  accepted: 4,
  receipt_uploaded: 6, // receipt is in → Program Head verifying it
  scheduled: 8, // all eight done
  rejected: -1,
}

export default function RequestStepper({
  status,
  paid,
  assessed = false,
  pending = false,
}: {
  status: RequestStatus
  paid: boolean
  /** Paid exams only: the Registrar has totalled this student's fees and passed
   *  them to the Cashier (payment_assessed_at is set). Defaults to false so a
   *  database without migration_payment_assessment.sql just shows the request
   *  sitting at Fee Assessment rather than mis-reporting a later stage. */
  assessed?: boolean
  /** Filled in but not actually submitted — the parent isn't verified yet, or
   *  the student hasn't pressed Submit. The row's status is already 'submitted'
   *  from the moment it is created, so without this the rail ticked "Submitted"
   *  directly under a pill reading "Not submitted yet". */
  pending?: boolean
}) {
  const STEP_LABELS = paid ? STEPS_PAID : STEPS_EXCUSED
  let current = (paid ? CURRENT_PAID : CURRENT_EXCUSED)[status] ?? 0
  // 'accepted' covers both sides of the Registrar's assessment — there is no
  // separate request_status for it, only the payment_assessed_at timestamp.
  if (paid && status === 'accepted' && assessed) current = 5
  // Still waiting on step one: being submitted at all.
  if (pending) current = 0
  const last = STEP_LABELS.length - 1
  // Gold line reaches up to whichever node is current (or the end when done).
  const fillTo = Math.min(current, last)
  const fillPct = (fillTo / last) * 100
  const done = current > last

  return (
    // --node is the circle's width. The track and the fill are inset by half of
    // it at each end so they run centre-to-centre, and it shrinks on phones.
    <div className="relative [--node:1.5rem] sm:[--node:2rem]">
      {/* base track + gold fill, centred on the nodes */}
      <div
        className="absolute h-0.5 -translate-y-1/2"
        style={{ left: 'calc(var(--node) / 2)', right: 'calc(var(--node) / 2)', top: 'calc(var(--node) / 2)', background: 'var(--border)' }}
      />
      <div
        className="absolute h-0.5 -translate-y-1/2 transition-[width] duration-300 ease-[var(--ease-out)]"
        style={{
          left: 'calc(var(--node) / 2)',
          top: 'calc(var(--node) / 2)',
          width: `calc((100% - var(--node)) * ${fillPct / 100})`,
          background: 'linear-gradient(90deg, #e0a200, var(--sti-gold))',
        }}
      />

      <div className="relative flex justify-between">
        {STEP_LABELS.map((label, i) => {
          const isDone = i < current
          const active = i === current
          return (
            // Phones: just the circle. Eight labels need ~450px side by side and a
            // phone card has ~330, so they piled into each other. The one label
            // that matters — the current step — is spelled out under the rail.
            <div key={label} className="flex flex-col items-center gap-1.5 sm:w-16">
              <div
                className="grid place-items-center rounded-full font-bold text-2xs sm:text-xs"
                style={{
                  width: 'var(--node)',
                  height: 'var(--node)',
                  ...(isDone
                    ? { background: 'var(--sti-gold)', color: '#fff' }
                    : active
                      ? { background: 'var(--sti-navy)', color: '#fff' }
                      : { background: 'var(--card)', border: '2px solid var(--border)', color: 'var(--muted)' }),
                }}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                className="hidden sm:block text-2xs text-center leading-tight"
                style={{ color: active ? 'var(--card-foreground)' : 'var(--muted)', fontWeight: active ? 600 : 400 }}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Phones only — the step the request is waiting on, in full. */}
      <p className="sm:hidden mt-2 text-xs" style={{ color: 'var(--card-foreground)' }}>
        {done ? (
          <strong>All steps complete</strong>
        ) : (
          <>
            <span className="ef-muted">Step {current + 1} of {STEP_LABELS.length} · </span>
            <strong>{STEP_LABELS[current]}</strong>
          </>
        )}
      </p>
    </div>
  )
}
