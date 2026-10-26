-- ─────────────────────────────────────────────────────────────
-- Teacher Analytics (/teacher/analytics) needs past terms.
--
-- exam_history was readable by admins and Program Heads only, so a Teacher's
-- charts would show the current term alone. A Teacher sees a live request when
-- it was routed to them (the section they teach, special_exam_requests.
-- teacher_id) or when they own the subject (migration_offerings.sql). This
-- gives history the same rule:
--   * teacher_id records who the request was routed to. purgeExpiredExams()
--     fills it from now on; older rows have none, and for them only the
--     subject-owner rule applies.
--   * the read policy adds the Teacher case. Admins and Program Heads read
--     exactly what they did before (migration_exam_history_ph_read.sql).
--
-- Still anonymized: the teacher is staff, and the row carries nothing about
-- the student.
--
-- Run once in the Supabase SQL editor, after migration_exam_history.sql.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────
alter table exam_history add column if not exists teacher_id uuid references profiles(id) on delete set null;
create index if not exists exam_history_teacher_idx on exam_history (teacher_id);

drop policy if exists "exam_history_read" on exam_history;
create policy "exam_history_read" on exam_history
  for select using (
    current_user_role() = 'admin'
    or (
      current_user_role() = 'program_head'
      and department_id = (select department_id from profiles where id = auth.uid())
    )
    or (
      current_user_role() = 'subject_teacher'
      and (
        teacher_id = auth.uid()
        or subject_id in (select id from subjects where teacher_id = auth.uid())
      )
    )
  );
