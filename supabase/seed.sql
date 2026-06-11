-- EXAMFLOW Seed: creates one test user per role
-- Run in Supabase SQL Editor AFTER schema.sql

-- Required for crypt() / gen_salt()
create extension if not exists pgcrypto;

DO $$
DECLARE
  admin_id uuid := uuid_generate_v4();
  reg_id   uuid := uuid_generate_v4();
  teach_id uuid := uuid_generate_v4();
  ph_id    uuid := uuid_generate_v4();
  stu_id   uuid := uuid_generate_v4();
  dept_id  uuid := uuid_generate_v4();
BEGIN

-- ── Departments ───────────────────────────────
INSERT INTO departments (id, name) VALUES
  (dept_id, 'College of Computer Studies');

-- ── Auth users (trigger will create profiles) ─
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
   created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', admin_id,
   'authenticated', 'authenticated', 'admin@examflow.com',
   crypt('Admin@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Admin User','role','admin'),
   now(), now()),

  ('00000000-0000-0000-0000-000000000000', reg_id,
   'authenticated', 'authenticated', 'registrar@examflow.com',
   crypt('Registrar@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Maria Santos','role','registrar'),
   now(), now()),

  ('00000000-0000-0000-0000-000000000000', teach_id,
   'authenticated', 'authenticated', 'teacher@examflow.com',
   crypt('Teacher@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Juan Dela Cruz','role','subject_teacher'),
   now(), now()),

  ('00000000-0000-0000-0000-000000000000', ph_id,
   'authenticated', 'authenticated', 'programhead@examflow.com',
   crypt('PHead@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Dr. Reyes','role','program_head'),
   now(), now()),

  ('00000000-0000-0000-0000-000000000000', stu_id,
   'authenticated', 'authenticated', 'student@examflow.com',
   crypt('Student@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   jsonb_build_object('full_name','Jose Rizal','role','student'),
   now(), now());

-- ── Fix roles (trigger may default to 'student') ─
UPDATE profiles SET role = 'admin'          WHERE id = admin_id;
UPDATE profiles SET role = 'registrar'      WHERE id = reg_id;
UPDATE profiles SET role = 'subject_teacher', department_id = dept_id WHERE id = teach_id;
UPDATE profiles SET role = 'program_head'   WHERE id = ph_id;
UPDATE profiles SET
  role = 'student',
  student_number = '2024-00001',
  course = 'BSIT',
  year_level = 2,
  section = 'A',
  department_id = dept_id
WHERE id = stu_id;

-- ── Sample subject assigned to teacher ────────
INSERT INTO subjects (subject_code, subject_name, department_id, teacher_id)
VALUES ('IT101', 'Introduction to Programming', dept_id, teach_id);

END $$;
