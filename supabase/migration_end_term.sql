-- EXAMFLOW migration — run in Supabase SQL Editor
--
-- Lets the Program Head END a term.
--
-- Until now a term could only be ended by starting the NEXT one: savePeriod()
-- activates a new period and deactivates the rest, and the staff queues follow
-- via keepActive(). There was no way to close a term and stop there — at the end
-- of a semester, for example.
--
-- Only one column is needed. Ending a term is otherwise is_active = false plus
-- auto-rejecting whatever was still awaiting review (see endTerm() in
-- app/program-head/actions.ts).

alter table exam_periods
  -- When the Program Head deliberately ended this term. NULL means it was never
  -- ended — either it is running now, or it was superseded when a later term was
  -- activated. This distinction is only for display: it lets Settings say
  -- "Ended 12 Mar" instead of just showing an inactive term with no explanation.
  add column if not exists ended_at timestamptz;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
-- No new policies. exam_periods_write already covers every column for
-- program_head and admin, and exam_periods_read is `using (true)` because every
-- role needs to see the active window.
