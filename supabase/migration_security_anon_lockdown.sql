-- ─────────────────────────────────────────────────────────────
-- SECURITY: stop logged-out visitors reading data (2026-10-27 audit).
--
-- FOUND: with only the public anon key (which every visitor's browser holds), a
-- logged-out person could read
--   * profiles    — every TEACHER's name and school email. The rule
--                   "role = 'subject_teacher'" (migration_teacher_visibility.sql,
--                   added so a student can see a teacher's name on the submit
--                   form) had no "logged in" condition.
--   * exam_periods — the term names, windows and exam dates (using (true)).
-- Nothing in the app reads either one before login: the landing page and the
-- login pop-up query no tables, and every role page is behind the proxy.
--
-- FIX: the same rules, restricted TO authenticated. A logged-in student still
-- sees teacher names; staff still see what they saw. Policies for anon are not
-- evaluated at all any more.
--
-- Not changed: departments (a list of department names; the sign-up page reads
-- it, and it holds nothing personal).
--
-- Run once in the Supabase SQL editor. Safe to re-run. Then run the checks at
-- the bottom: both must show 0 for anon.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or current_user_role() in ('admin', 'registrar', 'subject_teacher', 'program_head')
    or role = 'subject_teacher'
  );

drop policy if exists "exam_periods_read" on exam_periods;
create policy "exam_periods_read" on exam_periods
  for select to authenticated
  using (true);

-- Check (as the SQL editor's owner these show the real row counts; the proof
-- that anon is locked out is re-running the probe from the app side — ask Claude).
select
  (select count(*) from pg_policies where tablename = 'profiles'      and policyname = 'profiles_select'     and roles = '{authenticated}') as profiles_locked,
  (select count(*) from pg_policies where tablename = 'exam_periods'  and policyname = 'exam_periods_read'   and roles = '{authenticated}') as periods_locked;
-- Both columns should be 1.
