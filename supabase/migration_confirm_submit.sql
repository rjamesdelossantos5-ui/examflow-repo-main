-- EXAMFLOW migration — run in Supabase SQL Editor
--
-- Makes parent verification part of SUBMITTING, rather than something that
-- happens afterwards.
--
-- Before: filling in the form created the request and that was the submission;
-- verification came later on the request page. The form's button said "Submit
-- Request" even though submitting wasn't what it did.
--
-- After:  form  ->  "Continue to Parent Verification"  ->  verify at Didit
--               ->  back, now Verified  ->  "Submit Request"
--
-- The request row still has to exist before the parent is sent to Didit — Didit
-- needs something to attach the session to and somewhere to send the result —
-- so the row is created early but is NOT a submission until the student
-- confirms. That is what this column records.

alter table special_exam_requests
  -- When the student pressed "Submit Request" after their parent passed
  -- verification. NULL means the form was filled in but never actually
  -- submitted: the Registrar must not see it.
  --
  -- Requests created before this migration are all NULL, which would hide every
  -- one of them. The Registrar's query therefore only applies this check to
  -- requests that also carry a didit_status — i.e. ones created after parent
  -- verification existed. See app/registrar/page.tsx.
  add column if not exists student_confirmed_at timestamptz;

-- The Registrar's queue filters on this alongside status and didit_status.
create index if not exists idx_requests_confirmed
  on special_exam_requests (student_confirmed_at)
  where student_confirmed_at is not null;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
-- No new policies. requests_student_update_own already lets a student update
-- their own request, which is exactly who sets this column and when.
