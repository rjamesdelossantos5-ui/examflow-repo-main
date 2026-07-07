-- ─────────────────────────────────────────────────────────────
-- CATCH-UP SCRIPT: re-applies every migration_*.sql created so far, in
-- dependency order. Every statement is idempotent (if-not-exists / drop-
-- then-create), so this is safe to run even if some of these already
-- applied — it just fills in whatever is still missing.
--
-- Run this in the Supabase SQL editor if you're ever unsure which of the
-- individual migration_*.sql files you've actually run.
--
-- NOT included: migration_face.sql — it adds enum values with
-- `alter type ... add value`, which Postgres does not allow inside the same
-- transaction as other statements. Run that one separately (it's just two
-- lines) if you haven't already.
-- ─────────────────────────────────────────────────────────────

-- ── migration_periods.sql ──────────────────────
create table if not exists exam_periods (
  id               uuid primary key default gen_random_uuid(),
  term             text not null check (term in ('prelim', 'midterms', 'prefinals', 'finals')),
  school_year      text not null default '',
  submission_start date not null,
  window_days      int  not null default 7 check (window_days between 1 and 365),
  exam_day         timestamptz,
  exam_location    text,
  exam_bring       text,
  is_active        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (term, school_year)
);
alter table exam_periods enable row level security;
drop policy if exists "exam_periods_read" on exam_periods;
create policy "exam_periods_read" on exam_periods for select using (true);
drop policy if exists "exam_periods_write" on exam_periods;
create policy "exam_periods_write" on exam_periods for all
  using (current_user_role() in ('program_head', 'admin'))
  with check (current_user_role() in ('program_head', 'admin'));
alter table special_exam_requests add column if not exists period_id uuid references exam_periods(id);

-- ── migration_exam_schedule.sql ────────────────
alter table exam_periods add column if not exists exam_end_day timestamptz;

-- ── migration_snapshot.sql ─────────────────────
alter table special_exam_requests add column if not exists snap_name           text;
alter table special_exam_requests add column if not exists snap_student_number text;
alter table special_exam_requests add column if not exists snap_course         text;
alter table special_exam_requests add column if not exists snap_year_level     int;
alter table special_exam_requests add column if not exists snap_section        text;
update special_exam_requests r
set snap_name           = p.full_name,
    snap_student_number = p.student_number,
    snap_course         = p.course,
    snap_year_level     = p.year_level,
    snap_section         = p.section
from profiles p
where p.id = r.student_id
  and r.snap_name is null;
alter table profiles add column if not exists can_override boolean not null default false;

-- ── migration_form_fields.sql ──────────────────
alter table special_exam_requests add column if not exists snap_contact_number text;

-- ── migration_offerings.sql ────────────────────
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
create policy "offerings_read" on class_offerings for select using (auth.uid() is not null);
drop policy if exists "offerings_write" on class_offerings;
create policy "offerings_write" on class_offerings for all
  using (current_user_role() in ('admin', 'program_head'))
  with check (current_user_role() in ('admin', 'program_head'));
create index if not exists idx_offerings_subject on class_offerings (subject_id);

alter table special_exam_requests add column if not exists teacher_id uuid references profiles(id);
create index if not exists idx_requests_teacher on special_exam_requests (teacher_id);

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

-- ── migration_teacher_visibility.sql ───────────
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles
  for select using (
    id = auth.uid() or
    current_user_role() in ('admin', 'registrar', 'subject_teacher', 'program_head') or
    role = 'subject_teacher'
  );

-- ── migration_resubmit.sql ─────────────────────
drop policy if exists "requests_student_delete_own" on special_exam_requests;
create policy "requests_student_delete_own" on special_exam_requests
  for delete using (
    student_id = auth.uid()
    and status in ('submitted', 'rejected')
    and current_user_role() = 'student'
  );

-- ── migration_override.sql ─────────────────────
create table if not exists override_requests (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references special_exam_requests(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  reason_type  text not null check (reason_type in ('absent', 'on_leave', 'other')),
  reason_note  text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decided_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
alter table override_requests enable row level security;
drop policy if exists "override_select" on override_requests;
create policy "override_select" on override_requests for select using (
  requested_by = auth.uid() or current_user_role() = 'admin'
);
drop policy if exists "override_insert_ph" on override_requests;
create policy "override_insert_ph" on override_requests for insert with check (
  requested_by = auth.uid() and current_user_role() in ('program_head', 'admin')
);
drop policy if exists "override_admin_update" on override_requests;
create policy "override_admin_update" on override_requests for update using (
  current_user_role() = 'admin'
);
alter table override_requests replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'override_requests'
  ) then
    alter publication supabase_realtime add table override_requests;
  end if;
end $$;

-- ── migration_realtime.sql ─────────────────────
alter table special_exam_requests replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'special_exam_requests'
  ) then
    alter publication supabase_realtime add table special_exam_requests;
  end if;
end $$;

-- ── migration_storage_privacy.sql ──────────────
drop policy if exists "storage_allow_read" on storage.objects;
create policy "storage_allow_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'exam-documents'
    and (
      name not like 'requests/%/supporting_document.%'
      or exists (
        select 1 from public.special_exam_requests r
        where r.id::text = split_part(name, '/', 2)
          and (
            r.student_id = auth.uid()
            or public.current_user_role() in ('program_head', 'admin')
          )
      )
    )
  );

-- ── migration_notifications_seen.sql ───────────
alter table profiles add column if not exists notifications_seen_at timestamptz;

-- ── migration_schedule_notify.sql ───────────────
alter table exam_periods add column if not exists schedule_updated_at timestamptz;
alter table profiles add column if not exists schedule_ack text;

-- ── migration_indexes.sql ──────────────────────
create index if not exists idx_requests_status_submitted on special_exam_requests (status, submitted_at desc);
create index if not exists idx_requests_student on special_exam_requests (student_id);
create index if not exists idx_requests_period on special_exam_requests (period_id);
create index if not exists idx_requests_subject on special_exam_requests (subject_id);
create index if not exists idx_subjects_teacher on subjects (teacher_id);
create index if not exists idx_media_request on application_media (request_id);
create index if not exists idx_logs_request on progress_logs (request_id);
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'override_requests'
  ) then
    create index if not exists idx_override_status on override_requests (status);
    create index if not exists idx_override_request on override_requests (request_id);
    create index if not exists idx_override_requester on override_requests (requested_by);
  end if;
end $$;
