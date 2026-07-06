-- ─────────────────────────────────────────────────────────────
-- Let students remove a REJECTED request (in addition to a still-
-- pending one), so they can delete it or edit & resubmit.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "requests_student_delete_own" on special_exam_requests;
create policy "requests_student_delete_own" on special_exam_requests
  for delete using (
    student_id = auth.uid()
    and status in ('submitted', 'rejected')
    and current_user_role() = 'student'
  );
