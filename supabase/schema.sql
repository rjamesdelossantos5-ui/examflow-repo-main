-- EXAMFLOW Database Schema
--
-- ⚠️  FRESH DATABASE ONLY. This file uses `create type` / `create table` /
-- `create policy`, which ERROR if the object already exists (Postgres has no
-- `create type if not exists`). Running it on a database that already has these
-- objects fails on the first `create type` — that failure is harmless (nothing
-- is changed) but nothing gets applied either.
--
-- To update an EXISTING database, run the individual migration_*.sql files
-- instead — those are written to be re-run safely.
--
-- Run this in the Supabase SQL editor (new project only).

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────
create type user_role as enum ('admin', 'registrar', 'subject_teacher', 'program_head', 'student');
create type exam_type as enum ('paid', 'excused');
create type request_status as enum (
  'submitted',
  'verified_by_registrar',
  'approved_by_teacher',
  'accepted',
  'receipt_uploaded',
  'scheduled',
  'rejected'
);
create type excused_reason as enum ('medical', 'bereavement', 'other');

-- ─────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null,
  email          text not null unique,
  role           user_role not null default 'student',
  department_id  uuid,
  student_number text,
  course         text,
  year_level     int,
  section        text,
  is_active      boolean not null default true,
  -- When true, a program_head may approve/accept a request even if the
  -- registrar or teacher has not yet acted (admin-granted override).
  can_override   boolean not null default false,
  -- When the student last opened their notification bell — items older than
  -- this stop counting toward the bell badge (see lib/notifications.ts).
  notifications_seen_at timestamptz,
  -- Signature ("<periodId>:<scheduleUpdatedAt>") of the exam schedule the
  -- student has already acknowledged via the one-time popup — persists across
  -- logins (unlike the submission-window popup, which resets every login),
  -- and only re-prompts when the schedule actually changes.
  schedule_ack text,
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- DEPARTMENTS
-- ─────────────────────────────────────────────
create table departments (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table profiles add constraint fk_dept foreign key (department_id) references departments(id) on delete set null;

-- ─────────────────────────────────────────────
-- SUBJECTS
-- ─────────────────────────────────────────────
create table subjects (
  id            uuid primary key default uuid_generate_v4(),
  subject_code  text not null,
  subject_name  text not null,
  department_id uuid references departments(id) on delete set null,
  teacher_id    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique(subject_code, department_id)
);

-- ─────────────────────────────────────────────
-- SETTINGS (global app settings)
-- ─────────────────────────────────────────────
create table settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- Default: students have 7 days to submit
insert into settings (key, value) values ('submission_window_days', '7');

-- ─────────────────────────────────────────────
-- SPECIAL EXAM REQUESTS
-- ─────────────────────────────────────────────
create table special_exam_requests (
  id                 uuid primary key default uuid_generate_v4(),
  student_id         uuid not null references profiles(id) on delete cascade,
  subject_id         uuid not null references subjects(id) on delete restrict,
  exam_type          exam_type not null,
  excused_reason     excused_reason,
  other_reason       text,
  status             request_status not null default 'submitted',
  rejection_reason   text,
  rejected_by_role   user_role,
  final_schedule     timestamptz,
  -- Snapshot of the student's details AT submission time, so later profile
  -- edits don't retroactively change what an older request shows.
  snap_name          text,
  snap_student_number text,
  snap_course        text,
  snap_year_level    int,
  snap_section       text,
  snap_contact_number text,
  submitted_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- APPLICATION MEDIA (file uploads)
-- ─────────────────────────────────────────────
create type media_type as enum (
  'parent_id',
  'parent_id_back',
  'parent_signature',
  'parent_selfie',
  'supporting_document',
  'payment_receipt'
);

create table application_media (
  id          uuid primary key default uuid_generate_v4(),
  request_id  uuid not null references special_exam_requests(id) on delete cascade,
  media_type  media_type not null,
  storage_path text not null,
  file_name   text not null,
  mime_type   text not null,
  size_bytes  bigint not null,
  uploaded_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- PROGRESS LOGS (audit trail)
-- ─────────────────────────────────────────────
create table progress_logs (
  id          uuid primary key default uuid_generate_v4(),
  request_id  uuid not null references special_exam_requests(id) on delete cascade,
  actor_id    uuid not null references profiles(id) on delete restrict,
  actor_role  user_role not null,
  action      text not null,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- INDEXES (foreign keys are NOT auto-indexed in Postgres)
-- ─────────────────────────────────────────────
create index if not exists idx_requests_status_submitted on special_exam_requests (status, submitted_at desc);
create index if not exists idx_requests_student on special_exam_requests (student_id);
create index if not exists idx_requests_subject on special_exam_requests (subject_id);
create index if not exists idx_subjects_teacher on subjects (teacher_id);
create index if not exists idx_media_request on application_media (request_id);
create index if not exists idx_logs_request on progress_logs (request_id);

-- ─────────────────────────────────────────────
-- TRIGGERS: updated_at on special_exam_requests
-- ─────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_requests_updated_at
before update on special_exam_requests
for each row execute function set_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

create trigger trg_new_user
after insert on auth.users
for each row execute function handle_new_user();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

alter table profiles enable row level security;
alter table departments enable row level security;
alter table subjects enable row level security;
alter table special_exam_requests enable row level security;
alter table application_media enable row level security;
alter table progress_logs enable row level security;
alter table settings enable row level security;

-- Helper: get current user role
create or replace function current_user_role()
returns user_role language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- ── profiles ──────────────────────────────────
-- Users can read their own profile; staff can read all (needed for joins).
-- Everyone (including students) can read a TEACHER's row — a teacher's name is
-- normal directory info, and students need it when picking a section/teacher
-- on the submit form.
create policy "profiles_select" on profiles
  for select using (
    id = auth.uid() or
    current_user_role() in ('admin', 'registrar', 'subject_teacher', 'program_head') or
    role = 'subject_teacher'
  );

-- Admin can insert/update/delete any profile
create policy "profiles_admin_all" on profiles
  for all using (current_user_role() = 'admin');

-- Users can update their own profile (non-role fields)
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- ── departments ───────────────────────────────
-- Everyone can read departments
create policy "departments_read_all" on departments
  for select using (auth.uid() is not null);

-- Only admin can mutate
create policy "departments_admin_all" on departments
  for all using (current_user_role() = 'admin');

-- ── subjects ──────────────────────────────────
-- Everyone authenticated can read subjects
create policy "subjects_read_all" on subjects
  for select using (auth.uid() is not null);

-- Only admin can mutate
create policy "subjects_admin_all" on subjects
  for all using (current_user_role() = 'admin');

-- ── settings ──────────────────────────────────
-- Everyone authenticated can read settings
create policy "settings_read_all" on settings
  for select using (auth.uid() is not null);

-- Only admin and program_head can mutate
create policy "settings_ph_admin_mutate" on settings
  for all using (current_user_role() in ('admin', 'program_head'));

-- ── special_exam_requests ─────────────────────
-- Students: see only their own
create policy "requests_student_select" on special_exam_requests
  for select using (
    student_id = auth.uid() or
    current_user_role() in ('registrar', 'program_head', 'admin') or
    (current_user_role() = 'subject_teacher' and
     subject_id in (select id from subjects where teacher_id = auth.uid()))
  );

-- Students: insert their own
create policy "requests_student_insert" on special_exam_requests
  for insert with check (
    student_id = auth.uid() and current_user_role() = 'student'
  );

-- Registrar, teacher, program_head, admin: update
create policy "requests_staff_update" on special_exam_requests
  for update using (
    current_user_role() in ('registrar', 'subject_teacher', 'program_head', 'admin')
  );

-- Students can update their own (for receipt upload step)
create policy "requests_student_update_own" on special_exam_requests
  for update using (
    student_id = auth.uid() and current_user_role() = 'student'
  );

-- Students can delete their own submitted OR rejected requests
-- (roll back a failed upload, or clear/resubmit after a rejection)
create policy "requests_student_delete_own" on special_exam_requests
  for delete using (
    student_id = auth.uid() and status in ('submitted', 'rejected') and current_user_role() = 'student'
  );

-- Program Head / Admin can delete finished records (accepted or scheduled)
create policy "requests_ph_admin_delete" on special_exam_requests
  for delete using (
    current_user_role() in ('program_head', 'admin') and status in ('accepted', 'scheduled')
  );

-- ── override_requests (admin-override flow) ────
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
create policy "override_select" on override_requests for select using (
  requested_by = auth.uid() or current_user_role() = 'admin'
);
create policy "override_insert_ph" on override_requests for insert with check (
  requested_by = auth.uid() and current_user_role() in ('program_head', 'admin')
);
create policy "override_admin_update" on override_requests for update using (
  current_user_role() = 'admin'
);

-- ── exam_periods (Prelim / Midterms / Pre-finals / Finals) ────
create table if not exists exam_periods (
  id               uuid primary key default gen_random_uuid(),
  term             text not null check (term in ('prelim', 'midterms', 'prefinals', 'finals')),
  school_year      text not null default '',
  submission_start date not null,
  window_days      int  not null default 7 check (window_days between 1 and 365),
  exam_day         timestamptz,        -- START of the special-exam window
  exam_end_day     timestamptz,        -- END of the window (null = single day)
  exam_location    text,
  exam_bring       text,
  -- Stamped whenever the PH sets/changes the exam schedule (saveExamSchedule)
  -- — used to know if a student's already-seen schedule is now stale, both
  -- for the bell notification and the one-time popup.
  schedule_updated_at timestamptz,
  is_active        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (term, school_year)
);
alter table exam_periods enable row level security;
create policy "exam_periods_read" on exam_periods for select using (true);
create policy "exam_periods_write" on exam_periods for all
  using (current_user_role() in ('program_head', 'admin'))
  with check (current_user_role() in ('program_head', 'admin'));
alter table special_exam_requests add column if not exists period_id uuid references exam_periods(id);

-- ── class_offerings (subject + section → teacher) ────
-- Routing truth: a subject can be taught in several sections by different
-- teachers. The student picks subject → section, and the request routes to that
-- section's teacher (stored on the request as teacher_id).
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
create policy "offerings_read" on class_offerings for select using (auth.uid() is not null);
create policy "offerings_write" on class_offerings for all
  using (current_user_role() in ('admin', 'program_head'))
  with check (current_user_role() in ('admin', 'program_head'));
create index if not exists idx_offerings_subject on class_offerings (subject_id);

alter table special_exam_requests add column if not exists teacher_id uuid references profiles(id);
create index if not exists idx_requests_teacher on special_exam_requests (teacher_id);

-- Teacher visibility now includes requests routed to them via teacher_id
-- (plus the legacy "I own the subject" path).
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

-- ── application_media ─────────────────────────
-- Teachers deliberately do NOT get a document-visibility path here: the
-- teacher queue never shows parent ID / signature / receipts (showDocuments
-- is false there) — only Registrar/Program Head/Admin review those.
create policy "media_select" on application_media
  for select using (
    request_id in (
      select id from special_exam_requests
      where student_id = auth.uid()
        or current_user_role() in ('registrar', 'program_head', 'admin')
    )
  );

create policy "media_insert_student" on application_media
  for insert with check (
    request_id in (
      select id from special_exam_requests where student_id = auth.uid()
    )
  );

create policy "media_insert_staff" on application_media
  for insert with check (
    current_user_role() in ('registrar', 'subject_teacher', 'program_head', 'admin')
  );

-- ── progress_logs ─────────────────────────────
create policy "logs_select" on progress_logs
  for select using (
    actor_id = auth.uid() or
    request_id in (
      select id from special_exam_requests where student_id = auth.uid()
    ) or
    current_user_role() in ('registrar', 'program_head', 'admin') or
    (current_user_role() = 'subject_teacher' and
     request_id in (
       select id from special_exam_requests
       where teacher_id = auth.uid()
          or subject_id in (select id from subjects where teacher_id = auth.uid())
     ))
  );

create policy "logs_insert" on progress_logs
  for insert with check (actor_id = auth.uid());

-- ─────────────────────────────────────────────
-- STORAGE POLICIES (exam-documents bucket)
-- ─────────────────────────────────────────────
create policy "storage_allow_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'exam-documents');

-- The excuse certificate (requests/<id>/supporting_document.<ext>) is sensitive
-- personal data: only the owning student and the Program Head / Admin can read
-- it. All other files stay readable by authenticated staff.
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

create policy "storage_allow_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'exam-documents');

create policy "storage_allow_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'exam-documents');

-- ── Realtime ──────────────────────────────────
-- Required for the live notification bell and the live Accepted-Students list.
-- (Realtime still respects the RLS select policies above.)
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
