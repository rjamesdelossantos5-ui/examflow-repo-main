-- Fix: students could not see a teacher's name when picking a section on the
-- submit form. The "profiles_select" RLS policy only let a user read their OWN
-- profile row unless they were staff — so a student's join to the teacher's
-- profile (via class_offerings.teacher_id or subjects.teacher_id) silently came
-- back null, making every "Teacher:" field show "Not assigned yet" regardless
-- of how correct the underlying data was.
--
-- Fix: any authenticated user may read a profile row whose role is
-- 'subject_teacher' (a teacher's name is normal directory info — like seeing a
-- teacher's name on a syllabus). Nothing else about visibility changes: a
-- student still can't read other STUDENTS' profiles, admin profiles, etc.

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles
  for select using (
    id = auth.uid() or
    current_user_role() in ('admin', 'registrar', 'subject_teacher', 'program_head') or
    role = 'subject_teacher'
  );
