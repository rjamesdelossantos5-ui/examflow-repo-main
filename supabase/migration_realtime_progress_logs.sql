-- ─────────────────────────────────────────────────────────────
-- REAL-TIME USER ACTIVITY (Admin → User Activity).
--
-- progress_logs is the audit trail: one row for every step of a request
-- (submitted, parent verified, teacher approved, accepted, fee assessed, receipt
-- uploaded, receipt verified, rejected, automatic decisions). The Admin's User
-- Activity page now listens for new rows and shows them as they happen. For that
-- the table has to be in Supabase's Realtime publication.
--
-- Realtime only sends a row to someone who is allowed to read it, so the
-- existing logs_select policy still applies: an admin receives every new row, a
-- student or teacher only the rows they could already read.
--
-- Run once in the Supabase SQL editor. Safe to re-run. The last statement
-- prints a row; it should say true.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'progress_logs'
  ) then
    alter publication supabase_realtime add table progress_logs;
  end if;
end $$;

-- Confirmation: should be true.
select exists (
  select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'progress_logs'
) as progress_logs_is_realtime;
