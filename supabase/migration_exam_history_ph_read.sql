-- ─────────────────────────────────────────────────────────────
-- Program Head Analytics (/program-head/analytics) needs past terms.
--
-- exam_history was readable by admins only (migration_exam_history.sql), so a
-- Program Head's charts would silently show the current term alone. This lets
-- a Program Head read the rows of THEIR OWN department; admins still read all.
-- A Program Head with no department set reads none.
--
-- Run once in the Supabase SQL editor, after migration_exam_history.sql.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "exam_history_read" on exam_history;
create policy "exam_history_read" on exam_history
  for select using (
    current_user_role() = 'admin'
    or (
      current_user_role() = 'program_head'
      and department_id = (select department_id from profiles where id = auth.uid())
    )
  );
