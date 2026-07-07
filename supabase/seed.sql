-- EXAMFLOW Seed: creates one test user per role
-- Run in Supabase SQL Editor AFTER schema.sql
-- Safe to run multiple times (idempotent)

create extension if not exists pgcrypto;

create or replace function _seed_user(p_email text, p_password text, p_name text, p_role text)
returns uuid language plpgsql as $$
declare
  uid uuid;
  old_id uuid;
begin
  -- If this email already has an account with real activity against it
  -- (progress_logs, override_requests, requests), clear those first —
  -- otherwise deleting auth.users fails with a foreign-key violation (those
  -- tables reference profiles with "on delete restrict"/no action).
  select id into old_id from auth.users where email = p_email;
  if old_id is not null then
    delete from special_exam_requests where student_id = old_id or teacher_id = old_id;
    delete from progress_logs where actor_id = old_id;
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'override_requests') then
      execute 'delete from override_requests where requested_by = $1 or decided_by = $1' using old_id;
    end if;
  end if;

  delete from auth.users where email = p_email;
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change_token_new, email_change,
     phone_change, phone_change_token, reauthentication_token)
  values
    ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(),
     'authenticated', 'authenticated', p_email,
     crypt(p_password, gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}',
     jsonb_build_object('full_name', p_name, 'role', p_role),
     now(), now(),
     -- GoTrue's Go structs scan these as plain strings, never NULL. Leaving
     -- them at their column default (NULL) makes every login attempt fail
     -- with a 500 "Database error querying schema" / "converting NULL to
     -- string is unsupported" — the account exists but can never sign in.
     '', '', '', '', '', '', '')
  returning id into uid;

  -- Supabase Auth verifies email/password logins against auth.identities, not
  -- just auth.users. Without this row the account exists but every login
  -- attempt fails with "Invalid email or password".
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), uid,
    jsonb_build_object('sub', uid::text, 'email', p_email),
    'email', uid::text, now(), now(), now()
  );

  return uid;
end $$;

DO $$
DECLARE
  admin_id uuid;
  reg_id   uuid;
  teach_id uuid;
  ph_id    uuid;
  stu_id   uuid;
  dept_id  uuid;
BEGIN

-- ── Department (reuse if exists) ──────────────
INSERT INTO departments (id, name)
VALUES (uuid_generate_v4(), 'College of Computer Studies')
ON CONFLICT (name) DO NOTHING;

SELECT id INTO dept_id FROM departments WHERE name = 'College of Computer Studies';

-- ── Accounts ───────────────────────────────────
admin_id := _seed_user('admin@examflow.com',      'Admin@123',     'Admin User',   'admin');
reg_id   := _seed_user('registrar@examflow.com',  'Registrar@123', 'Maria Santos', 'registrar');
teach_id := _seed_user('teacher@examflow.com',    'Teacher@123',   'Juan Dela Cruz', 'subject_teacher');
ph_id    := _seed_user('programhead@examflow.com','PHead@123',     'Dr. Reyes',    'program_head');
stu_id   := _seed_user('student@examflow.com',    'Student@123',   'Jose Rizal',   'student');

-- ── Fix roles (trigger defaults everyone to 'student') ─
UPDATE profiles SET role = 'admin'   WHERE id = admin_id;
UPDATE profiles SET role = 'registrar' WHERE id = reg_id;
UPDATE profiles SET role = 'subject_teacher', department_id = dept_id WHERE id = teach_id;
UPDATE profiles SET role = 'program_head' WHERE id = ph_id;
UPDATE profiles SET
  role = 'student',
  student_number = '2024-00001',
  course = 'BSIT',
  year_level = 2,
  section = 'A',
  department_id = dept_id
WHERE id = stu_id;

-- ── Sample subject (reuse if exists) ──────────
INSERT INTO subjects (subject_code, subject_name, department_id, teacher_id)
VALUES ('IT101', 'Introduction to Programming', dept_id, teach_id)
ON CONFLICT (subject_code, department_id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id;

END $$;

drop function if exists _seed_user(text, text, text, text);
