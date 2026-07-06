-- ─────────────────────────────────────────────────────────────
-- Allow the Program Head / Admin to delete finished records
-- (accepted or scheduled) so the Accepted Students list can be
-- cleared after an exam period. Run once in the Supabase SQL editor.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "requests_ph_admin_delete" on special_exam_requests;
create policy "requests_ph_admin_delete" on special_exam_requests
  for delete using (
    current_user_role() in ('program_head', 'admin')
    and status in ('accepted', 'scheduled')
  );
