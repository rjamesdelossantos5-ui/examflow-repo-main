-- ─────────────────────────────────────────────────────────────
-- MULTI-SUBJECT SUBMISSION: a student can file up to 7 subjects in one go.
-- Each subject is its own request (own teacher and review); the requests filed
-- together share verification_group and one parent check (lib/verificationGroup.ts).
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────
alter table special_exam_requests add column if not exists verification_group uuid;
create index if not exists idx_requests_verification_group on special_exam_requests (verification_group) where verification_group is not null;

select exists (select 1 from information_schema.columns where table_name = 'special_exam_requests' and column_name = 'verification_group') as verification_group_added;

-- One parent check now covers several requests (same submission, or the same
-- term), so a Didit session id may appear on more than one request. The unique
-- index from migration_didit.sql ("one request per Didit session") blocked the
-- copy with: duplicate key value violates unique constraint
-- "idx_requests_didit_session". Replaced by a plain index (still an index hit
-- for the webhook's lookup).
drop index if exists idx_requests_didit_session;
create index if not exists idx_requests_didit_session
  on special_exam_requests (didit_session_id)
  where didit_session_id is not null;

select not exists (
  select 1 from pg_indexes where indexname = 'idx_requests_didit_session' and indexdef ilike '%unique%'
) as session_index_not_unique;
