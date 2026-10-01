-- ─────────────────────────────────────────────────────────────
-- SCHOOL DATA IMPORT (2026-10-01)
--
-- The admin uploads one workbook (Departments, Programs, Staff, Students,
-- Classes) on /admin/school-data — see lib/schoolData.ts. The school allowed a
-- made-up dataset because the real enrollment records are confidential.
--
--  - program_departments: each program's department (which Program Head
--    reviews its students) and its full name for the student form.
--  - class_offerings.import_batch: the import saves the new classes first and
--    removes older ones only after, so a failed import never empties the list.
--
-- Replaces migration_class_schedule.sql. If that one was run, this also drops
-- what it added for the features that were removed (the surname-matching
-- schedule import and the mock enrollment testing tool).
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

alter table class_offerings add column if not exists import_batch uuid;

create table if not exists program_departments (
  program       text primary key,
  department_id uuid not null references departments(id) on delete cascade
);
alter table program_departments add column if not exists name text;
alter table program_departments enable row level security;

drop policy if exists "program_departments_admin_all" on program_departments;
create policy "program_departments_admin_all" on program_departments
  for all using (current_user_role() = 'admin') with check (current_user_role() = 'admin');
-- Program names are shown on the student's request form.
drop policy if exists "program_departments_read" on program_departments;
create policy "program_departments_read" on program_departments
  for select using (auth.uid() is not null);

-- Left over from migration_class_schedule.sql, no longer used.
drop table if exists test_enrollments;
drop table if exists instructor_aliases;
alter table class_offerings drop column if exists instructor;

-- Confirmation: every value should be true.
select
  exists (select 1 from information_schema.columns where table_name = 'class_offerings' and column_name = 'import_batch') as offerings_batch,
  exists (select 1 from information_schema.columns where table_name = 'program_departments' and column_name = 'name')    as program_names,
  to_regclass('public.test_enrollments') is null   as test_enrollments_removed,
  to_regclass('public.instructor_aliases') is null as aliases_removed;
