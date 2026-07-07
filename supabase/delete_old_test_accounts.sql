-- ─────────────────────────────────────────────────────────────
-- Removes the OLD single-account test users (from seed.sql), now that
-- seed_test_accounts.sql provides the full curated set (ict.*, shs.*,
-- student1/2, admin, registrar).
--
-- Deletes: teacher@examflow.com, programhead@examflow.com,
--          student@examflow.com
-- Keeps:   admin@examflow.com, registrar@examflow.com
--
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids
  FROM profiles
  WHERE email IN ('teacher@examflow.com', 'programhead@examflow.com', 'student@examflow.com');

  -- Requests where these profiles are the student or the routed teacher
  -- (cascades to progress_logs / application_media / override_requests
  -- for those specific requests).
  DELETE FROM special_exam_requests WHERE student_id = ANY(ids) OR teacher_id = ANY(ids);

  -- Leftover references on requests belonging to OTHER students/teachers
  -- (e.g. this account approved/logged something on someone else's request).
  DELETE FROM progress_logs WHERE actor_id = ANY(ids);
  DELETE FROM override_requests WHERE requested_by = ANY(ids) OR decided_by = ANY(ids);

  -- Deleting auth.users cascades to profiles automatically
  -- (profiles.id references auth.users(id) on delete cascade).
  DELETE FROM auth.users WHERE id = ANY(ids);
END $$;
