import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { attachSignedUrls } from '@/lib/supabase/getSignedUrls'
import TeacherQueue from './TeacherQueue'

export const metadata = { title: 'EXAMFLOW — Teacher Queue' }

export default async function TeacherPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('special_exam_requests')
    .select(`
      id, exam_type, excused_reason, other_reason, status, submitted_at,
      profiles!student_id(full_name),
      subjects!inner(subject_code, subject_name, teacher_id),
      application_media(id, media_type, storage_path, file_name, mime_type),
      progress_logs(id, action, created_at, actor_role)
    `)
    .eq('status', 'verified_by_registrar')
    .order('submitted_at', { ascending: true })

  // RLS already filters by teacher; double-check teacher_id client side is optional
  const requests = await Promise.all(
    (raw ?? []).map(async (r) => {
      const mediaWithUrls = await attachSignedUrls(supabase, r.application_media ?? [])
      return {
        ...r,
        student: r.profiles as unknown as { full_name: string },
        subject: r.subjects as unknown as { subject_code: string; subject_name: string },
        media: (r.application_media ?? []).map((m, i) => ({ ...m, signed_url: mediaWithUrls[i]?.signed_url })),
        logs: r.progress_logs ?? [],
      }
    })
  )

  return <TeacherQueue requests={requests} />
}
