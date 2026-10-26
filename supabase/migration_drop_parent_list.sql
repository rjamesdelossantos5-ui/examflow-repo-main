-- Remove the Registrar's student–parent list (2026-10-26).
--
-- Why: the school's Registrar keeps no list of each student's father, mother or
-- guardian, so the list could never be filled in. The feature is gone from the
-- app: the Registrar → Parent List page, the upload, and the "matches the
-- mother on file / not on the parent list" line in the Program Head's First
-- Approval. The Program Head now checks the parent's ID and selfie by eye. The
-- only warning left is "Same name as the student", which needs no list.
--
-- This deletes the table and every name in it, and cannot be undone. The app no
-- longer reads it, so nothing breaks if you leave it for now.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

drop table if exists student_parents;
