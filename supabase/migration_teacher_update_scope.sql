-- ─────────────────────────────────────────────────────────────
-- SECURITY FIX: scope a Subject Teacher's UPDATE rights to their
-- own subjects.
--
-- The old "requests_staff_update" policy allowed ANY staff role to update
-- ANY request row:
--
--   for update using (
--     current_user_role() in ('registrar','subject_teacher','program_head','admin')
--   );
--
-- The ownership check lived only in the server action
-- (app/teacher/actions.ts). But the anon key is public by design, so a
-- signed-in teacher could call the Supabase REST API directly, bypass the
-- server action, and approve or reject any request in the system — including
-- students belonging to other teachers.
--
-- This moves the check into the database, where it holds no matter how the
-- request arrives. The scoping deliberately mirrors the SELECT policy in
-- migration_offerings.sql, so a teacher can now only write to the rows they
-- could already read.
--
-- Registrar / Program Head / Admin stay unscoped: they oversee every
-- department by design, and their own stage guards live in their actions.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "requests_staff_update" on special_exam_requests;

create policy "requests_staff_update" on special_exam_requests
  for update
  using (
    current_user_role() in ('registrar', 'program_head', 'admin')
    or (current_user_role() = 'subject_teacher' and (
      teacher_id = auth.uid()
      or subject_id in (select id from subjects where teacher_id = auth.uid())
    ))
  )
  -- WITH CHECK validates the row AFTER the update. Without it a teacher could
  -- edit a request's subject_id and push it outside their own scope in the
  -- same statement that they are allowed to make.
  with check (
    current_user_role() in ('registrar', 'program_head', 'admin')
    or (current_user_role() = 'subject_teacher' and (
      teacher_id = auth.uid()
      or subject_id in (select id from subjects where teacher_id = auth.uid())
    ))
  );
