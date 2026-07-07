-- Restrict the sensitive excuse certificate (medical / death certificate,
-- stored as requests/<id>/supporting_document.<ext>) so only the student who
-- owns the request and the Program Head / Admin can read it. Every other file
-- (ID front/back, parent signature, payment receipt) stays readable by
-- authenticated staff exactly as before.
--
-- NOTE: multiple SELECT policies are OR-combined, so we REPLACE the broad read
-- policy rather than adding a second one (a second one would just re-allow all).

drop policy if exists "storage_allow_read" on storage.objects;

create policy "storage_allow_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'exam-documents'
    and (
      -- Anything that is NOT the excuse certificate: unchanged (staff can read).
      name not like 'requests/%/supporting_document.%'
      -- The excuse certificate: only the owning student, or PH / Admin.
      or exists (
        select 1 from public.special_exam_requests r
        where r.id::text = split_part(name, '/', 2)
          and (
            r.student_id = auth.uid()
            or public.current_user_role() in ('program_head', 'admin')
          )
      )
    )
  );
