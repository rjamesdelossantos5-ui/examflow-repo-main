-- EXAMFLOW migration — run in Supabase SQL Editor
-- Adds per-request snapshot of student details so editing your profile later
-- does NOT change the name/section shown on older requests.

alter table special_exam_requests add column if not exists snap_name           text;
alter table special_exam_requests add column if not exists snap_student_number  text;
alter table special_exam_requests add column if not exists snap_course          text;
alter table special_exam_requests add column if not exists snap_year_level      int;
alter table special_exam_requests add column if not exists snap_section         text;

-- Backfill existing requests from the current profile (one-time)
update special_exam_requests r
set snap_name           = p.full_name,
    snap_student_number = p.student_number,
    snap_course         = p.course,
    snap_year_level     = p.year_level,
    snap_section        = p.section
from profiles p
where p.id = r.student_id
  and r.snap_name is null;

-- ─────────────────────────────────────────────
-- Program-head override authorization (granted by admin)
alter table profiles add column if not exists can_override boolean not null default false;

-- ─────────────────────────────────────────────
-- OPTIONAL: reset all test requests so you can test the flow cleanly.
-- Uncomment the next line, then re-run, to delete every request + its files refs.
-- delete from special_exam_requests;
