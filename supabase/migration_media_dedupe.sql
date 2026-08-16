-- ─────────────────────────────────────────────────────────────
-- FIX: uploaded documents duplicate on resubmit / receipt re-upload
--
-- Cause: application_media has RLS enabled but only SELECT and INSERT
-- policies — there was no DELETE (or UPDATE) policy at all. The app's
-- "delete the old row, then insert the new one" logic therefore deleted
-- ZERO rows (a blocked delete matches nothing and returns no error), and
-- the insert that followed added a SECOND row for the same slot. Every
-- resubmit or receipt re-upload piled on another copy.
--
-- This migration:
--   1. removes the duplicate rows already in the table (keeps the newest),
--   2. adds the missing DELETE + UPDATE policies,
--   3. adds a UNIQUE (request_id, media_type) constraint so one slot can
--      only ever hold one row — duplicates become structurally impossible
--      even if a policy is ever dropped again.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- 1. Clean up existing duplicates — keep the most recently uploaded row
--    for each (request_id, media_type) pair, delete the older copies.
delete from application_media a
using application_media b
where a.request_id = b.request_id
  and a.media_type = b.media_type
  and (a.uploaded_at, a.id) < (b.uploaded_at, b.id);

-- 2. The missing write policies.
--    Students may remove/replace media on their OWN requests.
drop policy if exists "media_delete_student" on application_media;
create policy "media_delete_student" on application_media
  for delete using (
    request_id in (
      select id from special_exam_requests where student_id = auth.uid()
    )
  );

drop policy if exists "media_update_student" on application_media;
create policy "media_update_student" on application_media
  for update using (
    request_id in (
      select id from special_exam_requests where student_id = auth.uid()
    )
  ) with check (
    request_id in (
      select id from special_exam_requests where student_id = auth.uid()
    )
  );

--    Staff who already manage requests may clean up media too (used by the
--    Program Head's manual delete and by purgeExpiredExams).
drop policy if exists "media_delete_staff" on application_media;
create policy "media_delete_staff" on application_media
  for delete using (current_user_role() in ('registrar', 'program_head', 'admin'));

drop policy if exists "media_update_staff" on application_media;
create policy "media_update_staff" on application_media
  for update using (current_user_role() in ('registrar', 'program_head', 'admin'))
  with check (current_user_role() in ('registrar', 'program_head', 'admin'));

-- 3. One row per document slot per request, enforced by the database.
--    (Step 1 must run first or this would fail on the existing duplicates.)
create unique index if not exists application_media_request_slot_uniq
  on application_media (request_id, media_type);
