-- ─────────────────────────────────────────────────────────────
-- REMOVE THE "FINALS" TERM (no special exam is held in Finals).
-- The app no longer offers it (lib/examSettings.ts). This removes what is
-- already stored. DESTRUCTIVE: run the three counts first and check them.
-- (When checked 2026-10-19: 2 finals periods, 6 requests in them, 6300
-- exam_history rows — the history rows feed Admin Analytics.)
-- ─────────────────────────────────────────────────────────────

-- 1. What would be removed
select
  (select count(*) from exam_periods where term = 'finals')                                         as finals_periods,
  (select count(*) from special_exam_requests where period_id in (select id from exam_periods where term = 'finals')) as requests_in_them,
  (select count(*) from exam_history where term = 'finals')                                         as history_rows;

-- 2. Remove them (uncomment to run)
-- delete from special_exam_requests where period_id in (select id from exam_periods where term = 'finals');
-- delete from exam_history where term = 'finals';
-- delete from exam_periods where term = 'finals';

-- 3. Only after step 2: stop the database accepting 'finals' again
-- alter table exam_periods drop constraint if exists exam_periods_term_check;
-- alter table exam_periods add constraint exam_periods_term_check check (term in ('prelim', 'midterms', 'prefinals'));
