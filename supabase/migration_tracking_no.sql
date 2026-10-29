-- ─────────────────────────────────────────────────────────────
-- REQUEST TRACKING NUMBER
--
-- Every special exam request gets one permanent reference number, for example
--     EF-2026-000123
-- so a developer can follow ONE form through the whole database, from the moment
-- it was submitted to Scheduled, and see exactly where it stopped.
--
-- WHAT THIS ADDS
--   1. special_exam_requests.tracking_no   unique, filled in automatically on insert,
--                                          never changeable afterwards.
--   2. tracking_no on every table that belongs to a request (progress_logs,
--      application_media, override_requests, request_views), filled in
--      automatically, so `where tracking_no = 'EF-...'` works in each of them.
--   3. request_status_history   one row for every status change of a request
--                               (who, when, from → to), including its creation and
--                               its DELETION. It has no link to the request, so it
--                               SURVIVES the request being deleted — which is what
--                               shows "it was removed by the cleanup at 14:05".
--   4. request_trace            a view that merges status changes, activity and
--                               file uploads for one tracking number, oldest first.
--
-- HOW A DEVELOPER USES IT (Supabase → SQL Editor)
--     select * from request_trace where tracking_no = 'EF-2026-000123' order by at;
--     select * from special_exam_requests where tracking_no = 'EF-2026-000123';
--     select * from progress_logs        where tracking_no = 'EF-2026-000123';
--     select * from request_status_history where tracking_no = 'EF-2026-000123' order by changed_at;
--   If the request is gone (deleted), request_status_history still has its rows,
--   ending in 'DELETED' with who or what deleted it.
--
-- Existing requests are numbered too (oldest first) and get a first history row
-- marked as backfilled.
--
-- Run once in the Supabase SQL editor. Safe to re-run. The last statement prints
-- a row; check that missing_numbers is 0.
-- ─────────────────────────────────────────────────────────────

-- ── 1. The number ───────────────────────────────────────────────────────────
create sequence if not exists request_tracking_seq start 1;

-- EF-<year in Manila>-<six digits>. SECURITY DEFINER so a student's insert can draw
-- from the sequence without being given access to it.
create or replace function next_request_tracking_no()
returns text language sql security definer set search_path = public as $$
  select 'EF-' || to_char(now() at time zone 'Asia/Manila', 'YYYY') || '-' || lpad(nextval('request_tracking_seq')::text, 6, '0')
$$;

alter table special_exam_requests add column if not exists tracking_no text;

-- Number the requests that exist already, oldest first. The two update triggers
-- are switched off for this one step so the numbering does not bump every
-- request's updated_at (the cleanup uses that time) or trip the student rules.
alter table special_exam_requests disable trigger trg_requests_updated_at;
alter table special_exam_requests disable trigger trg_student_status_transition;

do $$
declare r record;
begin
  for r in select id from special_exam_requests where tracking_no is null order by submitted_at, id loop
    update special_exam_requests set tracking_no = next_request_tracking_no() where id = r.id;
  end loop;
end $$;

alter table special_exam_requests enable trigger trg_requests_updated_at;
alter table special_exam_requests enable trigger trg_student_status_transition;

alter table special_exam_requests alter column tracking_no set default next_request_tracking_no();
alter table special_exam_requests alter column tracking_no set not null;
create unique index if not exists special_exam_requests_tracking_no_key on special_exam_requests (tracking_no);

-- Once given, a number never changes (not by a student, not by an admin).
create or replace function protect_tracking_no()
returns trigger language plpgsql as $$
begin
  if new.tracking_no is distinct from old.tracking_no then
    raise exception 'A request''s tracking number cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_tracking_no on special_exam_requests;
create trigger trg_protect_tracking_no
  before update on special_exam_requests
  for each row execute function protect_tracking_no();

-- ── 2. The number on every table that belongs to a request ──────────────────
create or replace function fill_request_tracking_no()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select tracking_no into new.tracking_no from special_exam_requests where id = new.request_id;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['progress_logs', 'application_media', 'override_requests', 'request_views'] loop
    -- A table this database does not have (older setups) is skipped.
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I add column if not exists tracking_no text', t);
    execute format(
      'update public.%I c set tracking_no = r.tracking_no from public.special_exam_requests r where r.id = c.request_id and c.tracking_no is null', t);
    execute format('create index if not exists %I on public.%I (tracking_no)', t || '_tracking_no_idx', t);
    execute format('drop trigger if exists trg_fill_tracking_no on public.%I', t);
    execute format(
      'create trigger trg_fill_tracking_no before insert on public.%I for each row execute function fill_request_tracking_no()', t);
  end loop;
end $$;

-- ── 3. Status history: survives the request ─────────────────────────────────
create table if not exists request_status_history (
  id               bigint generated always as identity primary key,
  request_id       uuid not null,      -- deliberately NOT a foreign key: the rows outlive the request
  tracking_no      text,
  from_status      text,               -- null when the request was created
  to_status        text not null,      -- 'DELETED' when the request was removed
  changed_at       timestamptz not null default now(),
  changed_by       uuid,               -- the signed-in user; null = the system, a service key, or the SQL editor
  changed_by_role  text,
  note             text
);

create index if not exists request_status_history_tracking_idx on request_status_history (tracking_no);
create index if not exists request_status_history_request_idx  on request_status_history (request_id);
create index if not exists request_status_history_changed_idx  on request_status_history (changed_at);

alter table request_status_history enable row level security;
drop policy if exists "request_status_history_admin_read" on request_status_history;
create policy "request_status_history_admin_read" on request_status_history
  for select using (current_user_role() = 'admin');
revoke all on table request_status_history from anon;

create or replace function log_request_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into request_status_history (request_id, tracking_no, from_status, to_status, changed_by, changed_by_role, note)
    values (new.id, new.tracking_no, null, new.status::text, auth.uid(), current_user_role()::text, 'created');
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into request_status_history (request_id, tracking_no, from_status, to_status, changed_by, changed_by_role)
      values (new.id, new.tracking_no, old.status::text, new.status::text, auth.uid(), current_user_role()::text);
    end if;
    return new;
  else
    -- DELETE: logged BEFORE the row goes, with what it looked like.
    insert into request_status_history (request_id, tracking_no, from_status, to_status, changed_by, changed_by_role, note)
    values (old.id, old.tracking_no, old.status::text, 'DELETED', auth.uid(), current_user_role()::text,
            'exam period ' || coalesce(old.period_id::text, 'none') || '; last changed ' || old.updated_at::text);
    return old;
  end if;
end $$;

drop trigger if exists trg_log_status_insert on special_exam_requests;
create trigger trg_log_status_insert after insert on special_exam_requests
  for each row execute function log_request_status();

drop trigger if exists trg_log_status_update on special_exam_requests;
create trigger trg_log_status_update after update on special_exam_requests
  for each row execute function log_request_status();

drop trigger if exists trg_log_status_delete on special_exam_requests;
create trigger trg_log_status_delete before delete on special_exam_requests
  for each row execute function log_request_status();

-- A first row for each request that already exists, so its trace is not empty.
insert into request_status_history (request_id, tracking_no, from_status, to_status, changed_at, note)
select r.id, r.tracking_no, null, r.status::text, r.submitted_at, 'before tracking began (backfilled)'
from special_exam_requests r
where not exists (select 1 from request_status_history h where h.request_id = r.id);

-- ── 4. One timeline per tracking number ─────────────────────────────────────
create or replace view request_trace as
  select h.tracking_no, h.request_id, h.changed_at as at, 'status'::text as source,
         coalesce(h.from_status, 'new') || ' -> ' || h.to_status as detail,
         coalesce(h.changed_by_role, 'system / service') as actor
  from request_status_history h
  union all
  select l.tracking_no, l.request_id, l.created_at, 'activity'::text, l.action, l.actor_role::text
  from progress_logs l
  union all
  select m.tracking_no, m.request_id, m.uploaded_at, 'file'::text, m.media_type::text || ' · ' || m.file_name, null::text
  from application_media m;

-- Developers read it in the SQL editor. It is closed to the app's API roles so it
-- cannot be used to read every request, whatever the view's security mode.
revoke all on request_trace from anon, authenticated;
do $$
begin
  alter view request_trace set (security_invoker = true);
exception when others then
  raise notice 'security_invoker not available here; the view stays closed to anon and authenticated.';
end $$;

-- ── Check ───────────────────────────────────────────────────────────────────
select
  (select count(*) from special_exam_requests)                              as requests,
  (select count(*) from special_exam_requests where tracking_no is null)    as missing_numbers,
  (select count(*) from request_status_history)                             as history_rows;
