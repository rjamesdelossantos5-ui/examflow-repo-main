-- ─────────────────────────────────────────────────────────────
-- MULTI-SUBJECT SUBMISSION: a student can file up to 7 subjects in one go.
-- Each subject is its own request (own teacher and review); the requests filed
-- together share verification_group and one parent check (lib/verificationGroup.ts).
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────
alter table special_exam_requests add column if not exists verification_group uuid;
create index if not exists idx_requests_verification_group on special_exam_requests (verification_group) where verification_group is not null;

select exists (select 1 from information_schema.columns where table_name = 'special_exam_requests' and column_name = 'verification_group') as verification_group_added;
