-- ─────────────────────────────────────────────────────────────
-- ALLOW DELETING AN ACCOUNT (Admin → Users → Delete).
--
-- THE PROBLEM
-- Deleting a login removes its profile, and any table that points at the profile
-- with no delete rule — or "on delete restrict" — refuses. The Delete button then
-- shows only "We couldn't delete this account".
--   * progress_logs.actor_id      ... on delete restrict   (schema.sql)
--   * override_requests.requested_by / decided_by   (no rule)  (removed feature)
--   * special_exam_requests.payment_assessed_by     (no rule)
--   * special_exam_requests.teacher_id              (no rule on one definition)
--
-- THE FIX
-- Each becomes "on delete set null": the history line / request stays, and the
-- person it names is simply blank. progress_logs keeps actor_role, so the
-- timeline still shows "Student / Registrar / …" for it.
-- progress_logs.actor_id must be nullable for that; pages that show the actor's
-- name should treat a blank one as unknown.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- Look up each foreign key by what it points at, so the constraint's own name
-- doesn't matter.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and c.confdeltype in ('a', 'r')   -- NO ACTION or RESTRICT
      and c.conrelid::regclass::text in (
        'progress_logs', 'override_requests', 'special_exam_requests'
      )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    -- A column that is NOT NULL cannot become null on delete.
    execute format('alter table %s alter column %I drop not null', r.tbl, r.col);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references profiles(id) on delete set null',
      r.tbl, r.conname, r.col
    );
    raise notice 'now set null on delete: %.%', r.tbl, r.col;
  end loop;
end $$;

-- Confirmation: should return no rows (nothing left that blocks a profile delete).
select c.conrelid::regclass as tbl, c.conname
from pg_constraint c
where c.contype = 'f'
  and c.confrelid = 'public.profiles'::regclass
  and c.confdeltype in ('a', 'r');
