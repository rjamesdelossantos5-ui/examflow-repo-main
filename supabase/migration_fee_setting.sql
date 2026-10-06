-- ─────────────────────────────────────────────────────────────
-- Special-exam fee, set by the admin (Admin → Settings) instead of being
-- written in code (lib/fees.ts used to hold a fixed ₱200).
--
-- 1. The fee lives in the `settings` table under 'special_exam_fee' (whole
--    pesos per subject). Only an admin may change settings — the old policy
--    also let Program Heads write here.
-- 2. When the Registrar marks a student assessed, the fee at that moment is
--    saved on each request (assessed_fee). A later fee change then affects only
--    students not yet assessed: someone already sent to the Cashier keeps the
--    amount they were told.
-- 3. assessed_fee joins the columns a student can never change on their own
--    request (see migration_protect_verification_columns.sql).
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- 1. The fee setting ──────────────────────────────────────────
create table if not exists settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table settings enable row level security;

insert into settings (key, value) values ('special_exam_fee', '200')
on conflict (key) do nothing;

drop policy if exists "settings_read_all" on settings;
create policy "settings_read_all" on settings
  for select using (auth.uid() is not null);

drop policy if exists "settings_ph_admin_mutate" on settings;
drop policy if exists "settings_admin_mutate" on settings;
create policy "settings_admin_mutate" on settings
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- 2. The fee locked in at assessment ──────────────────────────
alter table special_exam_requests
  add column if not exists assessed_fee integer check (assessed_fee >= 0);

-- 3. Students cannot change it ────────────────────────────────
-- Same function as migration_protect_verification_columns.sql, with
-- 'assessed_fee' added to protected_cols. Nothing else changed.
create or replace function enforce_student_status_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text;
  -- Fields only the server may set. A student never has a reason to.
  protected_cols text[] := array[
    'didit_session_id', 'didit_status', 'didit_checked_at', 'didit_event_id',
    'didit_liveness_score', 'didit_face_match_score', 'didit_document_type',
    'didit_id_name', 'didit_warnings',
    'student_confirmed_at',
    'payment_assessed_at', 'payment_assessed_by',
    'assessed_fee'
  ];
begin
  if current_user_role() = 'student' then

    if new.status is distinct from old.status then
      if not (
           (old.status = 'accepted' and new.status = 'receipt_uploaded')
        or (old.status = 'rejected'
            and new.status in ('submitted', 'verified_by_registrar', 'approved_by_teacher'))
      ) then
        raise exception
          'Students cannot move a request from % to %', old.status, new.status
          using errcode = 'check_violation';
      end if;
    end if;

    foreach col in array protected_cols loop
      if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
        raise exception
          'Students cannot change %', col
          using errcode = 'check_violation';
      end if;
    end loop;

  end if;
  return new;
end;
$$;

drop trigger if exists trg_student_status_transition on special_exam_requests;
create trigger trg_student_status_transition
  before update on special_exam_requests
  for each row execute function enforce_student_status_transition();
