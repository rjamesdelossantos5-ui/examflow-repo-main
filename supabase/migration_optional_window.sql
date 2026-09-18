-- Let a term be CURRENT without having a submission window yet.
--
-- Why: ending a term left no active term at all, and the only way to get one
-- was to fill in a submission start date. When the next term's special-exam
-- dates aren't announced yet, that forced the Program Head to invent a date —
-- which students then saw as a real "Opens Nov 3" promise. Worse, until a term
-- was set, keepActive() (lib/examSettings.ts) had no active id to filter by and
-- every queue fell back to showing requests from every term ever.
--
-- After this, the Program Head picks Semester + Term, leaves the date blank,
-- and saves. The term is active immediately (so queues filter correctly and
-- finished requests move to History) while submissions stay CLOSED until a
-- window is actually set.
--
-- Submissions staying closed is enforced in code, not here: computeWindow()
-- returns configured:false when submission_start is null, and every gate checks
-- `configured && open`. See app/student/submit/page.tsx and
-- app/student/submit/actions.ts.
--
-- Safe to re-run. Existing rows all have a date and are untouched.

alter table exam_periods
  alter column submission_start drop not null;

-- No RLS change. exam_periods_write already covers every column for
-- program_head and admin, and exam_periods_read is `using (true)`.
