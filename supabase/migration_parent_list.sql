-- ─────────────────────────────────────────────────────────────
-- REGISTRAR'S STUDENT–PARENT LIST (2026-10-03)
--
-- The Registrar uploads an Excel list of each student's father, mother and/or
-- other guardian (Registrar → Parent List). On the Registrar's queue and the
-- Program Head's first approval, the name Didit read off the parent's ID is
-- compared with it — "Matches the mother on file", "Not on the parent list",
-- "Same name as the student" — and the names on file are shown beside it.
-- Advice only: students can always submit; the reviewer decides. (The
-- automatic decline of a student verifying with their own ID was removed at
-- the same time.)
--
-- One row per person: relationship is 'Father', 'Mother', or the guardian's
-- relationship as written in the file ('Grandmother', 'Aunt', … or 'Guardian').
-- Each upload replaces the whole list. Made-up data, like the School Data file.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

create table if not exists student_parents (
  student_number text not null,     -- digits only, as on the student's profile
  student_name   text,              -- for reading the list; matching uses the number
  parent_name    text not null,
  relationship   text not null default 'Guardian',
  import_batch   uuid,
  created_at     timestamptz not null default now(),
  primary key (student_number, parent_name)
);
alter table student_parents add column if not exists relationship text not null default 'Guardian';

alter table student_parents enable row level security;

-- The Registrar keeps the list.
drop policy if exists "student_parents_registrar_all" on student_parents;
create policy "student_parents_registrar_all" on student_parents
  for all using (current_user_role() in ('registrar', 'admin'))
  with check (current_user_role() in ('registrar', 'admin'));

-- The Program Head reads it, to compare at first approval.
drop policy if exists "student_parents_ph_read" on student_parents;
create policy "student_parents_ph_read" on student_parents
  for select using (current_user_role() = 'program_head');

-- Confirmation: should be true.
select to_regclass('public.student_parents') is not null as parent_list_ready;
