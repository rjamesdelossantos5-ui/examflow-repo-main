-- Lets the student bell + a one-time popup correctly detect "the exam
-- schedule just changed", instead of the (buggy) proxy of period creation
-- time — a period is usually created before its schedule is filled in, so
-- that proxy almost never counted as "new".
alter table exam_periods add column if not exists schedule_updated_at timestamptz;
alter table profiles add column if not exists schedule_ack text;
