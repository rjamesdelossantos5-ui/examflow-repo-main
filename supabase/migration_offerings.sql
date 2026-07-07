-- ─────────────────────────────────────────────────────────────
-- Class offerings: which (subject + section) is taught by which teacher.
-- This is the routing truth — a subject can be taught in several sections by
-- different teachers, so the student picks subject → section, and the request
-- is routed to that section's teacher (stored on the request).
-- ─────────────────────────────────────────────────────────────

create table if not exists class_offerings (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references subjects(id) on delete cascade,
  section     text not null,
  teacher_id  uuid references profiles(id) on delete set null,
  year_level  int,
  created_at  timestamptz not null default now(),
  unique (subject_id, section)
);

alter table class_offerings enable row level security;

drop policy if exists "offerings_read" on class_offerings;
create policy "offerings_read" on class_offerings
  for select using (auth.uid() is not null);

drop policy if exists "offerings_write" on class_offerings;
create policy "offerings_write" on class_offerings
  for all using (current_user_role() in ('admin', 'program_head'))
  with check (current_user_role() in ('admin', 'program_head'));

create index if not exists idx_offerings_subject on class_offerings (subject_id);

-- The teacher a request was routed to (the chosen section's instructor).
alter table special_exam_requests add column if not exists teacher_id uuid references profiles(id);
create index if not exists idx_requests_teacher on special_exam_requests (teacher_id);

-- Teachers can now see a request routed to them via teacher_id, in addition to
-- the legacy "I own the subject" path (so older data keeps working).
drop policy if exists "requests_student_select" on special_exam_requests;
create policy "requests_student_select" on special_exam_requests
  for select using (
    student_id = auth.uid() or
    current_user_role() in ('registrar', 'program_head', 'admin') or
    (current_user_role() = 'subject_teacher' and (
      teacher_id = auth.uid() or
      subject_id in (select id from subjects where teacher_id = auth.uid())
    ))
  );

-- Same extension for the timeline the teacher sees in the review panel.
drop policy if exists "logs_select" on progress_logs;
create policy "logs_select" on progress_logs
  for select using (
    actor_id = auth.uid() or
    request_id in (select id from special_exam_requests where student_id = auth.uid()) or
    current_user_role() in ('registrar', 'program_head', 'admin') or
    (current_user_role() = 'subject_teacher' and request_id in (
      select id from special_exam_requests
      where teacher_id = auth.uid()
        or subject_id in (select id from subjects where teacher_id = auth.uid())
    ))
  );
