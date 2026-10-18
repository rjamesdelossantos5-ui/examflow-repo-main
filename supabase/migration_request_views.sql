-- ─────────────────────────────────────────────────────────────
-- Which requests each user has opened, so the bell badge only counts requests
-- they have not looked at yet.
--
-- One row per (user, request). A request counts as "read" for that user only
-- while viewed_at is at or after the request's updated_at — so when something
-- new happens to it (a new stage, a resubmit, a receipt) it shows as unread
-- again. The queue tab numbers (Pending Queue, etc.) do NOT use this table:
-- they stay the real count of work waiting.
--
-- Each person only ever reads and writes their own rows. Rows go away with the
-- user or the request (on delete cascade).
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

create table if not exists request_views (
  user_id     uuid not null references profiles(id) on delete cascade,
  request_id  uuid not null references special_exam_requests(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table request_views enable row level security;

drop policy if exists "request_views_own" on request_views;
create policy "request_views_own" on request_views
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Confirmation: should print true.
select exists (select 1 from pg_policies where tablename = 'request_views' and policyname = 'request_views_own') as request_views_ready;
