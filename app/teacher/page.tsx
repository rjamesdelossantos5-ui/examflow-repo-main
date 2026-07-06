import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeacherQueue from './TeacherQueue'

export const metadata = { title: 'EXAMFLOW — Teacher Queue' }

export default async function TeacherPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      profiles!student_id(full_name),
      subjects!inner(subject_code, subject_name, teacher_id),
      application_media(id, media_type, storage_path, file_name, mime_type),
      progress_logs(id, action, created_at, actor_role)
    `)
    .eq('status', 'verified_by_registrar')
    .order('submitted_at', { ascending: false })

  // RLS already filters by teacher. Media isn't shown to teachers, but we pass
  // it through; signed URLs are fetched lazily where documents are viewable.
  const requests = (raw ?? []).map((r) => {
    const prof = r.profiles as unknown as { full_name: string } | null
    return {
      ...r,
      student: { full_name: (r as { snap_name?: string | null }).snap_name ?? prof?.full_name ?? '—' },
      subject: r.subjects as unknown as { subject_code: string; subject_name: string },
      media: (r.application_media ?? []) as { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string }[],
      logs: r.progress_logs ?? [],
    }
  })

  return <TeacherQueue requests={requests} />
}
