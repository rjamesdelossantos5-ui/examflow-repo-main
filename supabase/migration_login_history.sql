-- ─────────────────────────────────────────────────────────────
-- Login history for Admin → Login History.
--
-- Supabase itself keeps only each account's LAST sign-in time
-- (auth.users.last_sign_in_at), overwritten every time — no history. This
-- table keeps one row per successful sign-in: who, their role, how they signed
-- in, and when. Nothing else (no IP address, no device) — the minimum needed,
-- per the Data Privacy Act commitment in PRODUCT.md.
--
-- Kept for 90 days: every new sign-in deletes rows older than that, so the
-- table never needs a separate cleanup job.
--
-- Rows are written ONLY by record_login() below, which reads the name and role
-- from the signed-in user's own profile. There is no insert policy, so nobody
-- can write a row directly (e.g. a fake "admin signed in" entry). Only admins
-- can read the table.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

create table if not exists login_history (
  id         uuid primary key default gen_random_uuid(),
  -- Kept (as null) if the account is later deleted, so the entry still shows
  -- the name and email it had at the time.
  user_id    uuid references profiles(id) on delete set null,
  full_name  text not null,
  email      text not null,
  role       text not null,
  method     text not null check (method in ('microsoft', 'password')),
  created_at timestamptz not null default now()
);

create index if not exists login_history_created_idx on login_history (created_at desc);

alter table login_history enable row level security;

drop policy if exists "login_history_admin_read" on login_history;
create policy "login_history_admin_read" on login_history
  for select using (current_user_role() = 'admin');

-- Called by the app right after a successful sign-in (lib/loginHistory.ts).
create or replace function record_login(p_method text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p profiles%rowtype;
begin
  if auth.uid() is null or p_method not in ('microsoft', 'password') then
    return;
  end if;
  select * into p from profiles where id = auth.uid();
  if not found then
    return;
  end if;

  insert into login_history (user_id, full_name, email, role, method)
  values (p.id, p.full_name, p.email, p.role::text, p_method);

  delete from login_history where created_at < now() - interval '90 days';
end;
$$;

revoke all on function record_login(text) from public;
grant execute on function record_login(text) to authenticated;
