-- ─────────────────────────────────────────────────────────────
-- SECURITY FIX: a student must never write their own verification or
-- payment-assessment fields.
--
-- THE HOLE
-- migration_student_update_scope.sql stops a student from moving a request to
-- an arbitrary STATUS, but it never looked at any other column. So a student
-- holding a 'rejected' request could call the public Supabase REST API
-- directly and PATCH:
--
--   { status: 'submitted', didit_status: 'Approved', student_confirmed_at: now() }
--
-- 'rejected' -> 'submitted' is an allowed resubmit, so the trigger let it
-- through — and the request then passed the Registrar gate
-- (lib/registrarGate.ts) with no parent verification at all. The same trick on
-- an 'accepted' request, with payment_assessed_at, skipped the Registrar's fee
-- assessment.
--
-- THE FIX
-- The same trigger now also refuses any student change to those fields. Every
-- legitimate write to them runs server-side with the service-role client
-- (lib/diditSync.ts, the Didit webhook, confirmSubmission, and the Registrar's
-- markPaymentAssessed on a staff session). For those callers auth.uid() is not
-- a student — current_user_role() returns NULL for the service role — so the
-- guard does not apply to them.
--
-- Verified before writing this: no update made through a student's own client
-- sets any of these columns (the resubmit payload and uploadReceipt were both
-- checked). Their INSERT is unaffected: this is a BEFORE UPDATE trigger.
--
-- Columns are compared through to_jsonb(), not NEW.col. A column that does not
-- exist yet (an unrun migration) then reads as NULL on both sides instead of
-- raising "record has no field" — which would have broken every student
-- update, including receipt uploads.
--
-- Replaces enforce_student_status_transition() from
-- migration_student_update_scope.sql. Its status rules are copied here
-- UNCHANGED. Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

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
    'payment_assessed_at', 'payment_assessed_by'
  ];
begin
  if current_user_role() = 'student' then

    -- 1. Status transitions — UNCHANGED from migration_student_update_scope.sql.
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

    -- 2. NEW: verification and assessment fields are server-only.
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

-- The trigger itself already exists (migration_student_update_scope.sql) and
-- calls this function by name, so replacing the function is enough. Recreated
-- anyway so this file also works on a database where that migration never ran.
drop trigger if exists trg_student_status_transition on special_exam_requests;
create trigger trg_student_status_transition
  before update on special_exam_requests
  for each row execute function enforce_student_status_transition();
