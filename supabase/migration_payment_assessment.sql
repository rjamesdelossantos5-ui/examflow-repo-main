-- EXAMFLOW migration — run in Supabase SQL Editor
--
-- Adds the Registrar's PAYMENT ASSESSMENT step for paid special exams.
--
-- The real process has the student visit the Registrar twice: once to collect
-- the form, and again after the Program Head's first approval — because the
-- Registrar has to total up how many special-exam subjects that student is
-- taking, work out what is owed, and pass it to the Cashier. Only then does the
-- student pay and come back with a receipt.
--
-- The system had no idea about the second visit: 'accepted' let a student upload
-- a receipt immediately. These columns are that missing step.
--
-- There is deliberately no new request_status value. Adding one ripples through
-- every status map, badge and stepper in the app (~16 files) to express
-- something two nullable columns already say. This mirrors student_confirmed_at
-- in migration_confirm_submit.sql.
--
-- Assessment is per STUDENT, not per request: the Registrar totals all of that
-- student's accepted paid subjects at once, so one action stamps all of them.

alter table special_exam_requests
  -- When the Registrar assessed this student's fees and passed the total to the
  -- Cashier. NULL on an accepted paid request means the Registrar hasn't done it
  -- yet, and the student must not be able to upload a receipt.
  --
  -- Excused requests never touch this: they skip 'accepted' entirely and go
  -- straight to 'scheduled' (see acceptRequest in app/program-head/actions.ts).
  --
  -- Paid requests accepted BEFORE this migration are all NULL, which would strand
  -- them waiting for an assessment nobody knew to do. The receipt-upload guard
  -- therefore only enforces this when the column exists — see the fallback in
  -- app/student/requests/[id]/actions.ts.
  add column if not exists payment_assessed_at timestamptz,
  -- Which Registrar did it. Audit trail: the progress log records it too, but
  -- having it on the row makes "who assessed this?" a single read.
  add column if not exists payment_assessed_by uuid references profiles(id);

-- The assessment queue is "accepted AND paid AND not yet assessed", so the
-- partial index covers exactly the rows that tab has to find.
create index if not exists idx_requests_awaiting_assessment
  on special_exam_requests (student_id)
  where payment_assessed_at is null;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
-- No new policies. requests_staff_update already covers the Registrar writing
-- these columns, and requests_student_select lets the student read their own
-- request (which is how the receipt-upload panel knows to say "waiting for the
-- Registrar" instead of showing the upload form).
