-- EXAMFLOW migration — run in Supabase SQL Editor
--
-- Parent identity verification via Didit (hosted flow).
--
-- The parent scans their ID and takes a liveness-checked selfie on Didit's own
-- domain; Didit posts the result back to /api/webhooks/didit. We store only the
-- DECISION and the SCORES — never the captured ID images. Didit's media URLs are
-- short-lived presigned links ("do not persist them as long-term references"),
-- and not holding parent ID documents is the smaller obligation under RA 10173.
--
-- Safe to re-run: every statement is guarded.

alter table special_exam_requests
  -- Didit's session id. Also the idempotency anchor: one session per request.
  add column if not exists didit_session_id      uuid,
  -- Verbatim Didit status: Approved / Declined / In Review / In Progress /
  -- Not Started / Abandoned / Expired / Kyc Expired / Resubmitted.
  -- Stored as text, not an enum — Didit can add values without warning, and an
  -- unknown value must not break the webhook.
  add column if not exists didit_status          text,
  -- Didit's own dispatch timestamp for the event that last wrote these columns.
  -- Guards against out-of-order delivery: a retried "In Progress" must not
  -- overwrite an "Approved" that arrived first. See the webhook route.
  add column if not exists didit_checked_at      timestamptz,
  -- event_id of the last applied webhook, so an immediate retry is a no-op.
  add column if not exists didit_event_id        uuid,
  -- 0–100. Confidence the selfie is a live person, not a photo or a screen.
  add column if not exists didit_liveness_score  numeric(5,2),
  -- 0–100. Similarity between the selfie and the portrait on the ID.
  add column if not exists didit_face_match_score numeric(5,2),
  -- e.g. 'Identity Card', 'Passport', 'Driver License'.
  add column if not exists didit_document_type   text,
  -- Full name as read off the ID. Not used for any check yet: there is no
  -- guardian name on file to compare it against. When the registrar supplies
  -- guardian names this is the column that closes that gap (and Didit's
  -- expected_details can then validate it at capture time instead).
  add column if not exists didit_id_name         text,
  -- Didit's warnings[] for the failing checks, kept verbatim so a reviewer can
  -- see WHY something was declined rather than just that it was.
  add column if not exists didit_warnings        jsonb;

-- One request per Didit session. Also makes the webhook's lookup an index hit.
create unique index if not exists idx_requests_didit_session
  on special_exam_requests (didit_session_id)
  where didit_session_id is not null;

-- Reviewers filter on "which of these are verified?"
create index if not exists idx_requests_didit_status
  on special_exam_requests (didit_status)
  where didit_status is not null;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
-- No new policies are needed.
--
-- Reads: these are columns on special_exam_requests, so the existing
-- requests_student_select policy already governs them — a student sees their
-- own, staff see the ones they review.
--
-- Writes: the webhook has no auth.uid(), so it matches NO policy on this table
-- (requests_staff_update needs current_user_role(), which reads from profiles
-- via auth.uid()). It therefore writes with the service-role client, which
-- bypasses RLS entirely. That is deliberate and is why SUPABASE_SERVICE_ROLE_KEY
-- is required for this feature — see lib/supabase/admin.ts.
