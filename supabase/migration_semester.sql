-- ─────────────────────────────────────────────────────────────
-- Add a Semester (1st / 2nd) to exam periods.
-- For now this is a single, school-wide semester (the per-program
-- semester handling — e.g. BSCpE running a 3rd/summer term while BSIT
-- runs 2 — is deliberately left for a later change).
--
-- Each (term, school_year, semester) becomes its own period row, so a
-- semester keeps its own Prelim → Finals records and history stays
-- correct. Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────
alter table exam_periods
  add column if not exists semester text not null default '1st'
  check (semester in ('1st', '2nd'));

-- The old uniqueness keyed (term, school_year); it has to make room for
-- the semester so both semesters can hold the same term (e.g. Finals).
alter table exam_periods drop constraint if exists exam_periods_term_school_year_key;

-- Defensive: drop any other leftover UNIQUE constraint on the table
-- (name may vary across environments). The primary key (contype 'p')
-- and the new index below are not touched.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'exam_periods'::regclass and contype = 'u'
  loop
    execute format('alter table exam_periods drop constraint %I', c.conname);
  end loop;
end $$;

create unique index if not exists exam_periods_term_sy_sem_key
  on exam_periods (term, school_year, semester);
