-- ─────────────────────────────────────────────────────────────
-- Removes the OLD-named accounts now that seed_test_accounts.sql creates
-- the same people under their surname-based emails instead:
--
--   registrar@examflow.com     -> santos@examflow.com
--   ict.teacher1@examflow.com  -> galamiton@examflow.com
--   ict.teacher2@examflow.com  -> valles@examflow.com
--   ict.head@examflow.com      -> vergara@examflow.com
--   shs.head@examflow.com      -> pangalinan@examflow.com
--   shs.teacher1@examflow.com  -> clara@examflow.com
--   shs.teacher2@examflow.com  -> go@examflow.com
--   student1@examflow.com      -> rizal@examflow.com
--   student2@examflow.com      -> penduko@examflow.com
--
-- Keeps: admin@examflow.com (never renamed).
-- Run once in the Supabase SQL editor, AFTER seed_test_accounts.sql has
-- successfully created the new-named accounts.
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids
  FROM profiles
  WHERE email IN (
    'registrar@examflow.com', 'ict.teacher1@examflow.com', 'ict.teacher2@examflow.com',
    'ict.head@examflow.com', 'shs.head@examflow.com', 'shs.teacher1@examflow.com',
    'shs.teacher2@examflow.com', 'student1@examflow.com', 'student2@examflow.com'
  );

  IF ids IS NULL THEN
    RAISE NOTICE 'None of the old-named accounts exist anymore — nothing to do.';
    RETURN;
  END IF;

  -- Requests where these profiles are the student or the routed teacher
  -- (cascades to progress_logs / application_media / override_requests for
  -- those specific requests).
  DELETE FROM special_exam_requests WHERE student_id = ANY(ids) OR teacher_id = ANY(ids);

  -- Leftover references on requests belonging to OTHER students/teachers.
  DELETE FROM progress_logs WHERE actor_id = ANY(ids);
  DELETE FROM override_requests WHERE requested_by = ANY(ids) OR decided_by = ANY(ids);

  -- Deleting auth.users cascades to profiles automatically.
  DELETE FROM auth.users WHERE id = ANY(ids);
END $$;
