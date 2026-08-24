-- ─────────────────────────────────────────────────────────────
-- SECURITY FIX: restrict which status changes a STUDENT may make.
--
-- The old policy was:
--
--   create policy "requests_student_update_own" on special_exam_requests
--     for update using (student_id = auth.uid() and current_user_role() = 'student');
--
-- No restriction on status. Because the anon key is public and every student
-- holds a valid session, a student could call the Supabase REST API directly,
-- bypass the server actions entirely, and PATCH their own request to
-- 'scheduled' — booking a special exam with zero review from the registrar,
-- teacher, or program head.
--
-- A student legitimately updates their own request in exactly two places
-- (verified against the whole codebase — these are the only two):
--
--   1. app/student/requests/[id]/actions.ts  uploadReceipt()
--        accepted -> receipt_uploaded
--   2. app/student/submit/actions.ts         resubmitRequest()
--        rejected -> submitted | verified_by_registrar | approved_by_teacher
--        (the three come from STAGE_AFTER_REJECTER — a resubmit returns to
--         whichever reviewer rejected it, so the student's own action writes
--         that stage.)
--
-- WHY A TRIGGER AND NOT JUST A POLICY:
-- RLS USING sees the row BEFORE the update; WITH CHECK sees it AFTER. Neither
-- can compare the two, so a policy alone could not stop 'rejected' ->
-- 'receipt_uploaded' (jumping into the receipt queue with no receipt). The
-- trigger below sees OLD and NEW together, so it can enforce the actual pairs.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- 1. Narrow WHICH rows a student may touch at all: only their own, and only
--    while the request is awaiting a receipt or has been rejected. A scheduled
--    or in-review request becomes read-only to them.
drop policy if exists "requests_student_update_own" on special_exam_requests;

create policy "requests_student_update_own" on special_exam_requests
  for update
  using (
    student_id = auth.uid()
    and current_user_role() = 'student'
    and status in ('accepted', 'rejected')
  )
  with check (
    student_id = auth.uid()
    and current_user_role() = 'student'
  );

-- 2. Enforce the exact transition pairs. Staff are untouched — the guard only
--    applies when the caller is a student, so registrar/teacher/program-head
--    actions and the purge job behave exactly as before.
create or replace function enforce_student_status_transition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user_role() = 'student' and new.status is distinct from old.status then
    if not (
         (old.status = 'accepted' and new.status = 'receipt_uploaded')
      or (old.status = 'rejected'
          and new.status in ('submitted', 'verified_by_registrar', 'approved_by_teacher'))
    ) then
      raise exception
        'Students cannot move a request from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_student_status_transition on special_exam_requests;
create trigger trg_student_status_transition
  before update on special_exam_requests
  for each row execute function enforce_student_status_transition();
