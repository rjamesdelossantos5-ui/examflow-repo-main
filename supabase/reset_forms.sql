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

-- Uploaded files: this clears the object records for the bucket. (You can also
-- empty the "exam-documents" bucket from Storage in the dashboard.)
delete from storage.objects where bucket_id = 'exam-documents';
