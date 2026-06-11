import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { attachSignedUrls } from '@/lib/supabase/getSignedUrls'
import PHQueue from './PHQueue'

export const metadata = { title: 'EXAMFLOW — Program Head Queue' }

export default async function ProgramHeadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('special_exam_requests')
    .select(`
      id, exam_type, excused_reason, other_reason, status, submitted_at, final_schedule,
      profiles!student_id(full_name, student_number, course, year_level, section),
      subjects(
        subject_code, subject_name,
        profiles!teacher_id(full_name)
      ),
      application_media(id, media_type, storage_path, file_name, mime_type),
      progress_logs(id, action, created_at, actor_role)
    `)
    .in('status', ['approved_by_teacher', 'receipt_uploaded'])
    .order('submitted_at', { ascending: true })

  const requests = await Promise.all(
    (raw ?? []).map(async (r) => {
      const mediaWithUrls = await attachSignedUrls(supabase, r.application_media ?? [])
      const subj = r.subjects as unknown as {
        subject_code: string
        subject_name: string
        profiles: { full_name: string } | null
      }
      return {
        ...r,
        student: r.profiles as unknown as { full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null },
        subject: {
          subject_code: subj?.subject_code ?? '',
          subject_name: subj?.subject_name ?? '',
          teacher: subj?.profiles ?? null,
        },
        media: (r.application_media ?? []).map((m, i) => ({ ...m, signed_url: mediaWithUrls[i]?.signed_url })),
        logs: r.progress_logs ?? [],
      }
    })
  )

  return <PHQueue requests={requests} />
}
