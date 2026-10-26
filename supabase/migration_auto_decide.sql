-- Let the system write history lines with no person behind them.
--
-- Why: lib/autoDecide.ts accepts or declines forms on its own when the
-- submission window closes (and declines paid forms with no receipt on the exam
-- day). Each decision gets a line in progress_logs like any other, but there is
-- no user who made it, so actor_id is null. schema.sql made actor_id NOT NULL;
-- migration_allow_user_delete.sql already drops that, so on a database where
-- that was run this does nothing.
--
-- Until this is run the decisions still happen — only their history line is
-- missing (and "[autoDecide] history log failed" appears in the server log).
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table progress_logs alter column actor_id drop not null;
