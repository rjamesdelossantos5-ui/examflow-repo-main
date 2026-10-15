-- ─────────────────────────────────────────────────────────────
-- LOCK: full_name and student_number come from the school's Microsoft 365
-- account / email, so a signed-in user may not change them on their own row.
--
-- THE HOLE
-- "profiles_update_own" lets a user UPDATE their own row, and the guard trigger
-- from migration_role_escalation.sql only protected role, is_active,
-- can_override and department_id. So anyone logged in could PATCH their own
-- full_name or student_number through the public Supabase REST API, bypassing
-- the locked fields on the My Account page.
--
-- THE FIX
-- enforce_profile_privileges() now also refuses, for non-admins:
--   * any change to full_name
--   * any change to student_number once it has a value (blank -> value is
--     allowed, so the first save of an email-derived number still works)
-- Admins and the service role / SQL editor (current_user_role() is NULL) are
-- unaffected, as before. The four columns protected by
-- migration_role_escalation.sql are copied here UNCHANGED.
--
-- Code changes that go with this (already made):
--   * app/auth/callback/route.ts swaps a placeholder name for the Microsoft
--     name with the service-role client (it ran as the user and would now be
--     refused).
--   * app/account/actions.ts only sends student_number while it is still blank.
--
-- Run once in the Supabase SQL editor. Safe to re-run. The last statement
-- prints a row; it should say true.
-- ─────────────────────────────────────────────────────────────

create or replace function enforce_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text;
  caller user_role := current_user_role();
  protected_cols text[] := array['role', 'is_active', 'can_override', 'department_id'];
begin
  -- NULL = service role / SQL editor (no logged-in profile). Admins may change anything.
  if caller is null or caller = 'admin' then
    return new;
  end if;

  -- Compared through to_jsonb() so a column that doesn't exist yet reads as
  -- NULL on both sides instead of raising.
  foreach col in array protected_cols loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'Only an admin can change %', col
        using errcode = 'insufficient_privilege';
    end if;
  end loop;

  -- Name comes from the Microsoft 365 account.
  if new.full_name is distinct from old.full_name then
    raise exception 'Only an admin can change full_name'
      using errcode = 'insufficient_privilege';
  end if;

  -- Student number comes from the school email; may be filled once, not changed.
  if new.student_number is distinct from old.student_number
     and coalesce(old.student_number, '') <> '' then
    raise exception 'Only an admin can change student_number'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profile_privileges on profiles;
create trigger trg_profile_privileges
  before update on profiles
  for each row execute function enforce_profile_privileges();

-- Confirmation: should be true.
select pg_get_functiondef('enforce_profile_privileges'::regproc) like '%student_number%' as name_and_number_locked;
