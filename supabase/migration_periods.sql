-- ─────────────────────────────────────────────────────────────
-- Exam periods (Prelim / Midterms / Pre-finals / Finals).
-- Replaces the single global submission settings so each term keeps
-- its own window + exam details, and every request is tied to the
-- period it was submitted under. Run once in the Supabase SQL editor.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────
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

-- Tie each request to the period it was submitted under.
alter table special_exam_requests add column if not exists period_id uuid references exam_periods(id);
