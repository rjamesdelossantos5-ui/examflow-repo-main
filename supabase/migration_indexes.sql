-- Performance indexes. Postgres does NOT auto-create indexes for foreign keys,
-- and every dashboard filters by status / joins by these keys, so without these
-- each query scans the whole table. All are safe to run repeatedly.

-- Queue pages: filter by status, order by submitted_at (newest first).
create index if not exists idx_requests_status_submitted
  on special_exam_requests (status, submitted_at desc);

-- Student dashboard + ownership checks.
create index if not exists idx_requests_student
  on special_exam_requests (student_id);

-- "Vanish when a new term is active" + per-term filtering.
create index if not exists idx_requests_period
  on special_exam_requests (period_id);

-- RLS teacher scoping + joins from requests to subjects.
create index if not exists idx_requests_subject
  on special_exam_requests (subject_id);
create index if not exists idx_subjects_teacher
  on subjects (teacher_id);

-- Document + timeline lookups per request.
create index if not exists idx_media_request
  on application_media (request_id);
create index if not exists idx_logs_request
  on progress_logs (request_id);

-- Admin override queue.
create index if not exists idx_override_status
  on override_requests (status);
create index if not exists idx_override_request
  on override_requests (request_id);
create index if not exists idx_override_requester
  on override_requests (requested_by);
