-- EXAMFLOW — Diagnose & repair the approval-chain data
-- Run this in the Supabase SQL Editor. Safe to run multiple times.
--
-- Why you need it: the test users were re-created in the dashboard, which gave
-- them NEW uuids. Any subject whose teacher_id pointed at an OLD (deleted) user
-- was reset to NULL by "on delete set null". The teacher queue only shows a
-- request when subjects.teacher_id = the logged-in teacher's id, so a NULL or
-- stale teacher_id makes the teacher queue look empty forever.

-- ─────────────────────────────────────────────
-- 1. DIAGNOSE — look at these results first
-- ─────────────────────────────────────────────

-- a) Confirm every test user has the right role
select 'ROLES' as check, email, role::text as role, id::text as profile_id
from profiles
order by role, email;

-- b) Which subjects have a teacher? (NULL teacher_email = nobody will see it)
select 'SUBJECTS' as check, s.subject_code, s.subject_name,
       p.email as teacher_email, s.teacher_id::text
from subjects s
left join profiles p on p.id = s.teacher_id
order by s.subject_code;

-- c) Pending requests and which teacher (if any) can see them
select 'PENDING' as check, r.id::text as request_id, r.status::text,
       s.subject_code, tp.email as routes_to_teacher
from special_exam_requests r
join subjects s on s.id = r.subject_id
left join profiles tp on tp.id = s.teacher_id
where r.status in ('submitted', 'verified_by_registrar')
order by r.submitted_at;

-- ─────────────────────────────────────────────
-- 2. REPAIR
-- ─────────────────────────────────────────────

-- a) Make sure the test users carry the intended roles
--    (dashboard-created users default to 'student' if no role metadata was set)
update profiles set role = 'admin'           where email = 'admin@examflow.com';
update profiles set role = 'registrar'        where email = 'registrar@examflow.com';
update profiles set role = 'subject_teacher'  where email = 'teacher@examflow.com';
update profiles set role = 'program_head'     where email = 'programhead@examflow.com';
-- (student@examflow.com stays 'student')

-- b) Assign EVERY subject that has no teacher to the test teacher.
--    In this single-teacher demo that guarantees whatever subject the student
--    picked routes to teacher@examflow.com. (Remove the WHERE clause to force
--    ALL subjects to the test teacher, even ones already assigned to someone else.)
update subjects
set teacher_id = (select id from profiles where email = 'teacher@examflow.com' limit 1)
where teacher_id is null;

-- ─────────────────────────────────────────────
-- 3. VERIFY — every pending request should now name a teacher
-- ─────────────────────────────────────────────
select 'AFTER FIX' as check, r.id::text as request_id, r.status::text,
       s.subject_code, tp.email as routes_to_teacher
from special_exam_requests r
join subjects s on s.id = r.subject_id
left join profiles tp on tp.id = s.teacher_id
where r.status in ('submitted', 'verified_by_registrar')
order by r.submitted_at;
