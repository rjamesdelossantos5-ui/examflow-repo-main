import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentsList from './StudentsList'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — Accepted Students' }

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('special_exam_requests')
    .select(`
      id, status, exam_type, final_schedule, submitted_at,
      profiles!student_id(full_name, student_number, course, year_level, section),
      subjects(
        subject_code, subject_name,
        profiles!teacher_id(full_name),
        departments(name)
      )
    `)
    .in('status', ['accepted', 'receipt_uploaded', 'scheduled'])
    .order('submitted_at', { ascending: false })

  const rows = (data ?? []).map((r) => {
    const subj = r.subjects as unknown as {
      subject_code: string
      subject_name: string
      profiles: { full_name: string } | null
      departments: { name: string } | null
    }
    const student = r.profiles as unknown as {
      full_name: string
      student_number: string | null
      course: string | null
      year_level: number | null
      section: string | null
    }
    return {
      id: r.id,
      status: r.status as RequestStatus,
      exam_type: r.exam_type,
      final_schedule: r.final_schedule,
      submitted_at: r.submitted_at,
      student_name: student?.full_name ?? '',
      student_number: student?.student_number ?? null,
      course: student?.course ?? null,
      year_level: student?.year_level ?? null,
      section: student?.section ?? null,
      subject_code: subj?.subject_code ?? '',
      subject_name: subj?.subject_name ?? '',
      teacher_name: subj?.profiles?.full_name ?? null,
      department_name: subj?.departments?.name ?? null,
    }
  })

  return <StudentsList initial={rows} />
}
