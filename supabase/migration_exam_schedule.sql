-- Special exam runs over a date range (e.g. July 7–8), not a single instant.
-- exam_day stays the START; exam_end_day is the (optional) END.
alter table exam_periods add column if not exists exam_end_day timestamptz;
