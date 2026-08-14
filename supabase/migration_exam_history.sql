-- ─────────────────────────────────────────────────────────────
-- Permanent, anonymized record of completed special exams — feeds the
-- Admin Analytics dashboard.
--
-- special_exam_requests rows get PERMANENTLY DELETED by purgeExpiredExams()
-- about a day after each term's exam (see lib/purgeExpiredExams.ts) — that's
-- deliberate, since those rows carry student IDs and uploaded documents. But
-- it means analytics built directly on that table would lose a term's numbers
-- the moment it gets purged, breaking any "history that keeps growing" view.
--
-- exam_history solves that: one row per request that reached 'scheduled'
-- (i.e. actually took the exam), written by the purge step just before it
-- deletes the source row. It carries NO student-identifying data — no
-- student_id, no name, no contact info, no documents — only the category
-- facts needed to chart trends (date, department, subject, exam type, term).
-- That's why it's safe to keep forever where the original row wasn't.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────
create table if not exists exam_history (
  id            uuid primary key default gen_random_uuid(),
  exam_date     date not null,              -- the date the exam was actually held
  department_id uuid references departments(id) on delete set null,
  subject_id    uuid references subjects(id) on delete set null,
  exam_type     text not null check (exam_type in ('paid', 'excused')),
  term          text,                       -- 'prelim' | 'midterms' | 'prefinals' | 'finals'
  semester      text,                       -- '1st' | '2nd'
  school_year   text,
  created_at    timestamptz not null default now()
);

create index if not exists exam_history_date_idx on exam_history (exam_date);
create index if not exists exam_history_dept_idx on exam_history (department_id);

alter table exam_history enable row level security;

drop policy if exists "exam_history_read" on exam_history;
create policy "exam_history_read" on exam_history
  for select using (current_user_role() = 'admin');

-- Written by purgeExpiredExams(), which runs under whichever Program Head /
-- admin happened to load a page that triggers it — so both roles need insert.
drop policy if exists "exam_history_insert" on exam_history;
create policy "exam_history_insert" on exam_history
  for insert with check (current_user_role() in ('program_head', 'admin'));
