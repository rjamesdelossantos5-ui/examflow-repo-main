-- ─────────────────────────────────────────────────────────────
-- CLASS SCHEDULE IMPORT + TESTING TOOLS (2026-09-30)
--
-- 1. Class schedule import (real admin workflow, /admin/schedule)
--    Each term the admin uploads the registrar's class schedule Excel
--    (section → subject → instructor). The import fills class_offerings,
--    which is what routes a student's request to the right teacher.
--    - class_offerings.instructor: the instructor exactly as the schedule
--      writes it ("SANTOS, M"), so a re-import or the test-teacher tool can
--      re-link it without the file.
--    - class_offerings.import_batch: lets the import add the new term's rows
--      first and only then remove last term's, so a failed import never
--      leaves students with an empty list.
--    - instructor_aliases: the admin's one-time "this surname is this teacher
--      account" matches, reused every term.
--    - program_departments: which department (and so which Program Head) a
--      program's sections belong to — the schedule has no department column.
--
-- 2. Testing tools (/admin/testing, only when ENABLE_TEST_TOOLS=true)
--    The school's enrollment data is confidential, so tests use made-up data:
--    - test_enrollments: a mock enrollment list (school email → section).
--    - test_accounts: accounts the test-teacher tool created, so Clean up can
--      delete exactly those and nothing else.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

alter table class_offerings add column if not exists instructor text;
alter table class_offerings add column if not exists import_batch uuid;

create table if not exists instructor_aliases (
  alias      text primary key,
  teacher_id uuid not null references profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table instructor_aliases enable row level security;
drop policy if exists "aliases_admin_all" on instructor_aliases;
create policy "aliases_admin_all" on instructor_aliases
  for all using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

create table if not exists program_departments (
  program       text primary key,
  department_id uuid not null references departments(id) on delete cascade
);
alter table program_departments enable row level security;
drop policy if exists "program_departments_admin_all" on program_departments;
create policy "program_departments_admin_all" on program_departments
  for all using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

create table if not exists test_enrollments (
  email      text primary key,
  section    text not null,
  created_at timestamptz not null default now()
);
alter table test_enrollments enable row level security;
drop policy if exists "test_enrollments_admin_all" on test_enrollments;
create policy "test_enrollments_admin_all" on test_enrollments
  for all using (current_user_role() = 'admin') with check (current_user_role() = 'admin');
-- A student may read only their own row (matched on their sign-in email).
drop policy if exists "test_enrollments_read_own" on test_enrollments;
create policy "test_enrollments_read_own" on test_enrollments
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));

create table if not exists test_accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table test_accounts enable row level security;
drop policy if exists "test_accounts_admin_all" on test_accounts;
create policy "test_accounts_admin_all" on test_accounts
  for all using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

-- Confirmation: every value should be true.
select
  exists (select 1 from information_schema.columns where table_name = 'class_offerings' and column_name = 'instructor')   as offerings_instructor,
  exists (select 1 from information_schema.columns where table_name = 'class_offerings' and column_name = 'import_batch') as offerings_batch,
  to_regclass('public.instructor_aliases') is not null  as aliases_table,
  to_regclass('public.program_departments') is not null as programs_table,
  to_regclass('public.test_enrollments') is not null    as test_enrollments_table,
  to_regclass('public.test_accounts') is not null       as test_accounts_table;
