-- ─────────────────────────────────────────────────────────────
-- ARCHIVE ACCOUNTS (Admin → Users → Archive / Restore).
--
-- Accounts are no longer deleted from the Users page. Archiving hides the
-- account from the main list and blocks its login (is_active = false), but keeps
-- the profile and everything linked to it. An admin can restore it later.
-- archived_at is the marker: NULL = not archived.
--
-- Run once in the Supabase SQL editor. Safe to re-run. The last statement
-- prints a row; it should say true.
-- ─────────────────────────────────────────────────────────────

alter table profiles add column if not exists archived_at timestamptz;

-- Confirmation: should be true.
select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'archived_at'
) as archived_at_column_exists;
