-- ─────────────────────────────────────────────────────────────
-- SCHOOL DATA: REVIEW BEFORE IMPORT (2026-10-03)
--
-- Uploading the School Data file no longer changes anything right away. The
-- checked file waits here; /admin/school-data shows what it would change
-- (new and changed accounts, classes added and removed, …) and the admin
-- either Accepts it (the import runs) or Cancels it (this row is deleted).
-- One file waits at a time — a new upload replaces it.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

create table if not exists school_data_imports (
  id         uuid primary key default gen_random_uuid(),
  file_name  text not null,
  data       jsonb not null,           -- the checked workbook (lib/schoolData.ts SchoolData)
  created_at timestamptz not null default now()
);

alter table school_data_imports enable row level security;

drop policy if exists "school_data_imports_admin_all" on school_data_imports;
create policy "school_data_imports_admin_all" on school_data_imports
  for all using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

-- Confirmation: should be true.
select to_regclass('public.school_data_imports') is not null as import_review_ready;
