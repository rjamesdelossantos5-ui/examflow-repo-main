-- ─────────────────────────────────────────────────────────────
-- Admin-override request flow.
-- When a reviewer (e.g. a teacher) is absent long-term, the Program
-- Head can request the Admin's permission to fast-track a stuck
-- request. Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────
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

-- PH sees their own requests; admin sees all.
drop policy if exists "override_select" on override_requests;
create policy "override_select" on override_requests for select using (
  requested_by = auth.uid() or current_user_role() = 'admin'
);

-- PH (or admin) creates a request for themselves.
drop policy if exists "override_insert_ph" on override_requests;
create policy "override_insert_ph" on override_requests for insert with check (
  requested_by = auth.uid() and current_user_role() in ('program_head', 'admin')
);

-- Only admin approves/denies.
drop policy if exists "override_admin_update" on override_requests;
create policy "override_admin_update" on override_requests for update using (
  current_user_role() = 'admin'
);

-- Live updates for the admin queue + PH overview.
alter table override_requests replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'override_requests'
  ) then
    alter publication supabase_realtime add table override_requests;
  end if;
end $$;
