-- ─────────────────────────────────────────────────────────────
-- TEST DATA (curated, real-ish): 2 departments, 4 subjects, 4 teachers,
-- 2 program heads, admin, registrar, 2 students, and class offerings that
-- route each (subject + section) to a specific teacher.
--
-- Run order:  1) migration_offerings.sql   2) reset_forms.sql   3) this file
-- Safe to re-run. Every account below uses the SAME password: Exam@123
--
-- ICT Department      Computer Programming (CP101), Game Development (GD101)
-- Senior High School  Earth & Life Science (ELS01), General Physics (PHY01)
--
-- A subject can be taught in several sections by different teachers, so the
-- student picks subject → section, and the form routes to that section's
-- teacher. The Accepted-Students live list still shows ALL departments.
--
-- Accounts (all password Exam@123):
--   admin@examflow.com          admin
--   santos@examflow.com         Maria Santos (registrar)
--   galamiton@examflow.com      Joshua Galamiton (ICT)
--   valles@examflow.com         Kid Valles       (ICT)
--   clara@examflow.com          Maria Clara      (SHS)
--   go@examflow.com             Alice Go         (SHS)
--   vergara@examflow.com        Ms. Lara Camille Vergara (ICT Head)
--   pangalinan@examflow.com     Ms. Grace Pangilinan     (SHS Head)
--   rizal@examflow.com          Jose Rizal, student (course BSIT)
--   penduko@examflow.com        Pedro Penduko, student (course STEM)
--
-- The student-facing Course dropdown is trimmed to exactly 2 for testing:
-- BSIT (tertiary) and STEM (senior high) — matching the offerings below.
--
-- Offerings:
--   CP101  BSIT 2-201 → Galamiton   BSIT 2-202 → Valles
--   GD101  BSIT 3-201 → Galamiton   BSIT 3-202 → Valles
--   ELS01  STEM 11-A  → Maria Clara STEM 11-B  → Alice Go
--   PHY01  STEM 12-A  → Maria Clara STEM 12-B  → Alice Go
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create or replace function _seed_user(p_email text, p_password text, p_name text, p_role text)
returns uuid language plpgsql as $$
declare
  uid uuid;
  old_id uuid;
begin
  -- If this email already has an account (e.g. re-running this script after
  -- testing has generated real activity under it), clear everything that
  -- references its profile first — otherwise deleting auth.users fails with a
  -- foreign-key violation (progress_logs.actor_id, override_requests, etc. all
  -- reference profiles with "on delete restrict"/no action, not cascade).
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
  -- just auth.users. Without a matching identity row, the account exists but
  -- every login attempt fails with "Invalid email or password". Signup via the
  -- normal /login flow creates this row automatically; a raw SQL insert has to
  -- create it explicitly.
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
  ict_id uuid; shs_id uuid;
  t_g uuid; t_gm uuid; t_p uuid; t_l uuid;   -- Galamiton, Valles, Maria Clara, Alice Go
  admin_id uuid; reg_id uuid; ph_ict uuid; ph_shs uuid; stu1 uuid; stu2 uuid;
  cp uuid; gd uuid; els uuid; phy uuid;      -- subject ids
  pw text := 'Exam@123';
BEGIN

-- ── Departments ───────────────────────────────
INSERT INTO departments (name) VALUES ('ICT Department') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Senior High School') ON CONFLICT (name) DO NOTHING;
SELECT id INTO ict_id FROM departments WHERE name = 'ICT Department';
SELECT id INTO shs_id FROM departments WHERE name = 'Senior High School';

-- ── Accounts ──────────────────────────────────
admin_id := _seed_user('admin@examflow.com',       pw, 'System Admin',        'admin');
reg_id   := _seed_user('santos@examflow.com',      pw, 'Maria Santos',        'registrar');
t_g      := _seed_user('galamiton@examflow.com',   pw, 'Instructor Joshua Galamiton', 'subject_teacher');
t_gm     := _seed_user('valles@examflow.com',       pw, 'Instructor Kid Valles',       'subject_teacher');
t_p      := _seed_user('clara@examflow.com',       pw, 'Instructor Maria Clara',      'subject_teacher');
t_l      := _seed_user('go@examflow.com',          pw, 'Instructor Alice Go',         'subject_teacher');
ph_ict   := _seed_user('vergara@examflow.com',     pw, 'Ms. Lara Camille Vergara',    'program_head');
ph_shs   := _seed_user('pangalinan@examflow.com',  pw, 'Ms. Grace Pangilinan',        'program_head');
stu1     := _seed_user('rizal@examflow.com',       pw, 'Jose Rizal',          'student');
stu2     := _seed_user('penduko@examflow.com',     pw, 'Pedro Penduko',       'student');

-- ── Roles + departments (trigger defaults everyone to 'student') ──
UPDATE profiles SET role='admin'                              WHERE id=admin_id;
UPDATE profiles SET role='registrar'                          WHERE id=reg_id;
UPDATE profiles SET role='subject_teacher', department_id=ict_id WHERE id IN (t_g, t_gm);
UPDATE profiles SET role='subject_teacher', department_id=shs_id WHERE id IN (t_p, t_l);
UPDATE profiles SET role='program_head',    department_id=ict_id WHERE id=ph_ict;
UPDATE profiles SET role='program_head',    department_id=shs_id WHERE id=ph_shs;
-- stu1 = BSIT (tertiary), stu2 = STEM (senior high) — one of each for testing
-- the 2-course setup.
UPDATE profiles SET role='student', student_number='2024-00001', course='BSIT', year_level=2, section='BSIT 2-201', department_id=ict_id WHERE id=stu1;
UPDATE profiles SET role='student', student_number='2024-00002', course='STEM', year_level=1, section='STEM 11-A', department_id=shs_id WHERE id=stu2;

-- ── Wipe old test requests first ───────────────
-- Rebuilding subjects/offerings below requires them to be unreferenced.
-- special_exam_requests.subject_id is "on delete restrict", so any leftover
-- test submissions from previous runs block the DELETEs further down unless
-- cleared here (this cascades to progress_logs / application_media /
-- override_requests for those requests automatically).
DELETE FROM special_exam_requests;

-- ── Subjects (teacher_id null: routing is via class_offerings) ──
DELETE FROM subjects;
INSERT INTO subjects (subject_code, subject_name, department_id) VALUES
  ('CP101', 'Computer Programming',   ict_id) RETURNING id INTO cp;
INSERT INTO subjects (subject_code, subject_name, department_id) VALUES
  ('GD101', 'Game Development',        ict_id) RETURNING id INTO gd;
INSERT INTO subjects (subject_code, subject_name, department_id) VALUES
  ('ELS01', 'Earth and Life Science', shs_id) RETURNING id INTO els;
INSERT INTO subjects (subject_code, subject_name, department_id) VALUES
  ('PHY01', 'General Physics',        shs_id) RETURNING id INTO phy;

-- ── Offerings (subject + section → teacher) ──
DELETE FROM class_offerings;
INSERT INTO class_offerings (subject_id, section, teacher_id, year_level) VALUES
  (cp,  'BSIT 2-201', t_g,  2),
  (cp,  'BSIT 2-202', t_gm, 2),
  (gd,  'BSIT 3-201', t_g,  3),
  (gd,  'BSIT 3-202', t_gm, 3),
  (els, 'STEM 11-A',  t_p,  null),
  (els, 'STEM 11-B',  t_l,  null),
  (phy, 'STEM 12-A',  t_p,  null),
  (phy, 'STEM 12-B',  t_l,  null);

END $$;

drop function if exists _seed_user(text, text, text, text);
