-- ─────────────────────────────────────────────────────────────
-- Enable Supabase Realtime for live notifications + live lists.
--
-- Without this, Postgres does not broadcast row changes, so the
-- header notification bell and the Accepted-Students list only
-- update on a manual page refresh. Run this once in the Supabase
-- SQL editor (Database → SQL). Safe to re-run.
--
-- Realtime still respects RLS: each subscriber only receives change
-- events for rows they are allowed to SELECT (already covered by the
-- existing policies in schema.sql).
-- ─────────────────────────────────────────────────────────────

-- Full row data on UPDATE/DELETE events (so filters/old values work).
alter table special_exam_requests replica identity full;

-- Add the table to the Realtime publication (guard against duplicates).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'special_exam_requests'
  ) then
    alter publication supabase_realtime add table special_exam_requests;
  end if;
end $$;
