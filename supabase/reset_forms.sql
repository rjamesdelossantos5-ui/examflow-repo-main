-- ─────────────────────────────────────────────────────────────
-- FRESH START — wipe all special-exam activity but KEEP the accounts,
-- subjects, and departments. Run in the Supabase SQL editor.
--
-- Removes: every request + its documents + its timeline, all override
-- requests, and all exam periods/schedules.
-- Keeps: profiles (users), subjects, departments, settings.
-- ─────────────────────────────────────────────────────────────

-- Child rows first (these also cascade from special_exam_requests, but we're
-- explicit so this is safe to run even if the FKs change).
delete from progress_logs;
delete from application_media;
delete from override_requests;

-- The forms themselves.
delete from special_exam_requests;

-- Terms / schedules — so no window or exam date is set until you make a new one.
delete from exam_periods;

-- NOTE: uploaded files are NOT deleted by this script. Supabase blocks direct
-- SQL deletes on storage.objects ("Direct deletion from storage tables is not
-- allowed"). To clear the uploaded documents, go to:
--   Supabase Dashboard → Storage → exam-documents bucket → select all → Delete
-- This is optional — leftover files in storage don't affect the app (the rows
-- pointing to them were just deleted above), they're just unused disk space.
