-- The physical Special Exam form also asks for the student's contact number.
alter table special_exam_requests add column if not exists snap_contact_number text;
