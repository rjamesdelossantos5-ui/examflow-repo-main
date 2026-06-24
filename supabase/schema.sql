-- EXAMFLOW Database Schema
-- Run this in the Supabase SQL editor

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
-- Users can read their own profile; staff can read all (needed for joins)
create policy "profiles_select" on profiles
  for select using (
    id = auth.uid() or
    current_user_role() in ('admin', 'registrar', 'subject_teacher', 'program_head')
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

-- Students can delete their own submitted requests (used to roll back failed uploads)
create policy "requests_student_delete_own" on special_exam_requests
  for delete using (
    student_id = auth.uid() and status = 'submitted' and current_user_role() = 'student'
  );

-- ── application_media ─────────────────────────
create policy "media_select" on application_media
  for select using (
    request_id in (
      select id from special_exam_requests
      where student_id = auth.uid()
        or current_user_role() in ('registrar', 'program_head', 'admin')
        or (current_user_role() = 'subject_teacher' and
            subject_id in (select id from subjects where teacher_id = auth.uid()))
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
       where subject_id in (select id from subjects where teacher_id = auth.uid())
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

create policy "storage_allow_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'exam-documents');

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
