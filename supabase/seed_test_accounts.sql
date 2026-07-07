-- ─────────────────────────────────────────────────────────────
-- TEST DATA: 2 departments, 4 subjects, 2 teachers (2 subjects each),
-- 2 program heads, and an extra student — for testing department-scoped routing.
--
-- Temporary manual accounts (Microsoft login comes later). Safe to re-run.
-- Run AFTER reset_forms.sql if you want a clean slate.
--
--   ICT Department      → IT101, IT102   → Teacher 1  → ICT program head
--   Senior High School  → GEN01, GEN02   → Teacher 2  → SHS program head
--   A subject only reaches its own teacher; a PH only sees their department.
--   The Accepted-Students live list still shows ALL departments.
--
-- Accounts (email / password):
--   teacher@examflow.com      Teacher@123   (ICT) IT101 + IT102
--   teacher.shs@examflow.com  Teacher@123   (SHS) GEN01 + GEN02
--   programhead@examflow.com  PHead@123     ICT Department Head
--   ph.shs@examflow.com       PHead@123     Senior High School Head
--   student2@examflow.com     Student@123   student
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- Helper: create (or reset) an email/password auth user with role metadata.
create or replace function _seed_user(p_email text, p_password text, p_name text, p_role text)
returns uuid language plpgsql as $$
declare uid uuid;
begin
  delete from auth.users where email = p_email;
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(),
     'authenticated', 'authenticated', p_email,
     crypt(p_password, gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}',
     jsonb_build_object('full_name', p_name, 'role', p_role),
     now(), now())
  returning id into uid;
  return uid;
end $$;

DO $$
DECLARE
  ict_id   uuid;
  shs_id   uuid;
  t_ict    uuid;
  t_shs    uuid;
  ph_ict   uuid;
  ph_shs   uuid;
  stu2     uuid;
BEGIN

-- ── Departments ───────────────────────────────
INSERT INTO departments (name) VALUES ('ICT Department') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Senior High School') ON CONFLICT (name) DO NOTHING;
SELECT id INTO ict_id FROM departments WHERE name = 'ICT Department';
SELECT id INTO shs_id FROM departments WHERE name = 'Senior High School';

-- ── Teachers: one per department, 2 subjects each ──
t_ict := _seed_user('teacher@examflow.com',     'Teacher@123', 'Juan Dela Cruz', 'subject_teacher');
t_shs := _seed_user('teacher.shs@examflow.com', 'Teacher@123', 'Ana Lim',        'subject_teacher');

-- ── Program heads ─────────────────────────────
ph_ict := _seed_user('programhead@examflow.com', 'PHead@123', 'Dr. Reyes (ICT Head)',  'program_head');
ph_shs := _seed_user('ph.shs@examflow.com',      'PHead@123', 'Ms. Flores (SHS Head)', 'program_head');

-- ── Extra student ─────────────────────────────
stu2 := _seed_user('student2@examflow.com', 'Student@123', 'Pedro Penduko', 'student');

-- ── Assign roles + departments (trigger defaults everyone to 'student') ──
UPDATE profiles SET role = 'subject_teacher', department_id = ict_id WHERE id = t_ict;
UPDATE profiles SET role = 'subject_teacher', department_id = shs_id WHERE id = t_shs;
UPDATE profiles SET role = 'program_head',    department_id = ict_id WHERE id = ph_ict;
UPDATE profiles SET role = 'program_head',    department_id = shs_id WHERE id = ph_shs;
UPDATE profiles SET role = 'student', student_number = '2024-00002', course = 'BSIT', year_level = 2, section = 'A', department_id = ict_id WHERE id = stu2;

-- ── Exactly 4 subjects: 2 ICT (Teacher 1), 2 SHS (Teacher 2) ──
-- (Requires no existing requests referencing subjects — run reset_forms.sql first.)
DELETE FROM subjects;
INSERT INTO subjects (subject_code, subject_name, department_id, teacher_id) VALUES
  ('IT101', 'Introduction to Programming', ict_id, t_ict),
  ('IT102', 'Data Structures',             ict_id, t_ict),
  ('GEN01', 'General Mathematics',         shs_id, t_shs),
  ('GEN02', 'Earth Science',               shs_id, t_shs);

END $$;

drop function if exists _seed_user(text, text, text, text);
