-- ─────────────────────────────────────────────────────────────
-- REMOVE THE OLD HAND-MADE TEST DATA (2026-10-01)
--
-- Departments, programs, accounts, subjects and classes now come from the
-- School Data workbook (/admin/school-data). This removes what the old seed
-- scripts (seed.sql, seed_test_accounts.sql) and earlier testing left behind,
-- by exact name only:
--
--   Accounts:    santos@ / registrar@ / rizal@ / penduko@examflow.com and the
--                casano.340503+galamiton/valles/clara/go/vergara/pangalinan
--                stand-ins (made-up teachers and Program Heads)
--   Subjects:    CP101, GD101, ELS01, PHY01 — and their 8 classes
--   Departments: College of Computer Studies, Senior High School, Something
--   Analytics:   the exam history recorded for those subjects/departments
--   Requests:    any test request on those subjects or by those accounts
--
-- Keeps: admin@examflow.com, every real @stamaria account (their role and
-- details are set again by the School Data import), ICT Department (the
-- workbook uses the same name), the exam terms, and settings.
--
-- Run once in the Supabase SQL editor. Everything happens in one step: if
-- any part fails, nothing is removed. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  old_users    uuid[];
  old_subjects uuid[];
  old_depts    uuid[];
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO old_users
  FROM auth.users
  WHERE lower(email) IN (
    'santos@examflow.com', 'registrar@examflow.com',
    'rizal@examflow.com', 'penduko@examflow.com',
    'casano.340503+galamiton@stamaria.sti.edu.ph', 'casano.340503+valles@stamaria.sti.edu.ph',
    'casano.340503+clara@stamaria.sti.edu.ph', 'casano.340503+go@stamaria.sti.edu.ph',
    'casano.340503+vergara@stamaria.sti.edu.ph', 'casano.340503+pangalinan@stamaria.sti.edu.ph'
  );

  SELECT coalesce(array_agg(id), '{}') INTO old_subjects
  FROM subjects
  WHERE subject_code IN ('CP101', 'GD101', 'ELS01', 'PHY01');

  SELECT coalesce(array_agg(id), '{}') INTO old_depts
  FROM departments
  WHERE name IN ('College of Computer Studies', 'Senior High School', 'Something');

  -- Test requests (cascades to their timeline, documents and override
  -- requests). special_exam_requests.subject_id is "on delete restrict", so
  -- these must go before the subjects.
  DELETE FROM special_exam_requests
  WHERE subject_id = ANY(old_subjects)
     OR student_id = ANY(old_users) OR teacher_id = ANY(old_users)
     OR payment_assessed_by = ANY(old_users);

  -- Anything these accounts did on other requests.
  DELETE FROM progress_logs WHERE actor_id = ANY(old_users);
  DELETE FROM override_requests WHERE requested_by = ANY(old_users) OR decided_by = ANY(old_users);

  -- Analytics rows for the test subjects. Deleting the subjects alone would
  -- leave them on the dashboard as "Unknown Subject" / "Unassigned".
  DELETE FROM exam_history WHERE subject_id = ANY(old_subjects) OR department_id = ANY(old_depts);

  DELETE FROM class_offerings WHERE subject_id = ANY(old_subjects);
  DELETE FROM subjects WHERE id = ANY(old_subjects);

  -- Deleting auth.users cascades to profiles
  -- (profiles.id references auth.users(id) on delete cascade).
  DELETE FROM auth.users WHERE id = ANY(old_users);

  DELETE FROM departments WHERE id = ANY(old_depts);
END $$;

-- Confirmation: every value should be true.
select
  not exists (select 1 from auth.users where lower(email) in (
    'santos@examflow.com', 'registrar@examflow.com', 'rizal@examflow.com', 'penduko@examflow.com'))
  and not exists (select 1 from auth.users where lower(email) like 'casano.340503+%')       as old_accounts_removed,
  not exists (select 1 from subjects where subject_code in ('CP101', 'GD101', 'ELS01', 'PHY01')) as old_subjects_removed,
  not exists (select 1 from departments where name in ('College of Computer Studies', 'Senior High School', 'Something')) as old_departments_removed,
  not exists (select 1 from class_offerings where section like 'STEM%')                       as shs_classes_removed,
  exists (select 1 from profiles where email = 'admin@examflow.com' and role = 'admin')        as admin_kept;
