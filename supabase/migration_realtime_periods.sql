-- Enables Realtime on exam_periods so a Program Head activating a submission
-- window or saving the exam schedule pushes instantly to already-open student
-- dashboards, instead of requiring a manual refresh. Mirrors
-- migration_realtime.sql, which only ever covered special_exam_requests.
-- Safe to re-run.

alter table exam_periods replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'exam_periods'
  ) then
    alter publication supabase_realtime add table exam_periods;
  end if;
end $$;
