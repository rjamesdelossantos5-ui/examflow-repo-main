-- Fix: teachers routed to a request via class_offerings (special_exam_requests
-- .teacher_id) could see the request itself but NOT its uploaded documents
-- (Valid ID, parent signature, supporting document) — the "media_select"
-- policy was only ever updated with the legacy "subjects.teacher_id" path.
-- Every teacher seeded via seed_test_accounts.sql routes purely through
-- teacher_id (their subjects.teacher_id is null), so this blocked ALL of
-- them from opening any submitted document. Run once in the SQL editor.

drop policy if exists "media_select" on application_media;
create policy "media_select" on application_media
  for select using (
    request_id in (
      select id from special_exam_requests
      where student_id = auth.uid()
        or current_user_role() in ('registrar', 'program_head', 'admin')
        or (current_user_role() = 'subject_teacher' and (
            teacher_id = auth.uid() or
            subject_id in (select id from subjects where teacher_id = auth.uid())))
    )
  );
