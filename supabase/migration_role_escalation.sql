-- ─────────────────────────────────────────────────────────────
-- SECURITY FIX: nobody may give themselves a role, activate themselves,
-- grant themselves the override, or move themselves to another department.
--
-- THE HOLES (both lead to "anyone can become admin")
-- 1. handle_new_user() copied the role from raw_user_meta_data — a field the
--    person signing up writes themselves. With public sign-up on, anyone could
--    call the Supabase API with the public anon key and
--      signUp({ email, password, options: { data: { role: 'admin' } } })
--    and get an admin profile.
-- 2. The "profiles_update_own" policy lets a user UPDATE their own row, and
--    nothing limited WHICH columns. Any logged-in user could PATCH their own
--    profile with { role: 'admin' } through the public REST API.
--
-- THE FIX
-- 1. New accounts are always created as 'student'. The admin Users page is
--    unaffected: after createUser it upserts the profile with the chosen role
--    as the admin (app/admin/users/actions.ts), which fix #2 allows.
-- 2. A BEFORE UPDATE trigger refuses changes to role, is_active, can_override
--    and department_id unless the caller is an admin — or has no profile role
--    at all, which is the service role and the SQL editor (current_user_role()
--    returns NULL there), so seed scripts and server-side code keep working.
--
-- Verified before writing this: the only profile updates made through a
-- non-admin user's own client set full_name, student_number, course,
-- year_level, section (app/account/actions.ts), notifications_seen_at
-- (app/notificationActions.ts), schedule_ack and window_ack
-- (app/student/bannerActions.ts). None touch the protected columns.
--
-- Run once in the Supabase SQL editor. Safe to re-run. The last statement
-- prints a row; both columns should say true.
-- ─────────────────────────────────────────────────────────────

-- 1. Sign-up: always 'student', never the role the user asked for.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'student'
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

-- 2. Profile updates: privilege columns are admin-only.
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
  -- NULL on both sides instead of raising (same approach as
  -- migration_protect_verification_columns.sql).
  foreach col in array protected_cols loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'Only an admin can change %', col
        using errcode = 'insufficient_privilege';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_profile_privileges on profiles;
create trigger trg_profile_privileges
  before update on profiles
  for each row execute function enforce_profile_privileges();

-- Confirmation: both should be true.
select
  pg_get_functiondef('handle_new_user'::regproc) not like '%raw_user_meta_data->>''role''%' as signup_role_fixed,
  exists (select 1 from pg_trigger where tgname = 'trg_profile_privileges')               as profile_guard_installed;
