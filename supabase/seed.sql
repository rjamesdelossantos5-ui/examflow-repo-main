-- EXAMFLOW Seed: creates one test user per role
-- Run in Supabase SQL Editor AFTER schema.sql
-- Safe to run multiple times (idempotent)

create extension if not exists pgcrypto;

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

-- ── Helper: upsert one auth user, return its id ─
-- We delete + re-insert so passwords are always reset

DELETE FROM auth.users WHERE email = 'admin@examflow.com';
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(),
   'authenticated', 'authenticated', 'admin@examflow.com',
   crypt('Admin@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Admin User','role','admin'),
   now(), now());
SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@examflow.com';

DELETE FROM auth.users WHERE email = 'registrar@examflow.com';
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(),
   'authenticated', 'authenticated', 'registrar@examflow.com',
   crypt('Registrar@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Maria Santos','role','registrar'),
   now(), now());
SELECT id INTO reg_id FROM auth.users WHERE email = 'registrar@examflow.com';

DELETE FROM auth.users WHERE email = 'teacher@examflow.com';
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(),
   'authenticated', 'authenticated', 'teacher@examflow.com',
   crypt('Teacher@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Juan Dela Cruz','role','subject_teacher'),
   now(), now());
SELECT id INTO teach_id FROM auth.users WHERE email = 'teacher@examflow.com';

DELETE FROM auth.users WHERE email = 'programhead@examflow.com';
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(),
   'authenticated', 'authenticated', 'programhead@examflow.com',
   crypt('PHead@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Dr. Reyes','role','program_head'),
   now(), now());
SELECT id INTO ph_id FROM auth.users WHERE email = 'programhead@examflow.com';

DELETE FROM auth.users WHERE email = 'student@examflow.com';
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(),
   'authenticated', 'authenticated', 'student@examflow.com',
   crypt('Student@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Jose Rizal','role','student'),
   now(), now());
SELECT id INTO stu_id FROM auth.users WHERE email = 'student@examflow.com';

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
