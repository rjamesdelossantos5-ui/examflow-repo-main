import { createClient } from '@/lib/supabase/server'
import SubjectUpload from './SubjectUpload'

export const metadata = { title: 'EXAMFLOW Admin — Subjects' }

export default async function SubjectsPage() {
  const supabase = await createClient()

  const [{ data: subjects }, { data: departments }, { data: teachers }] = await Promise.all([
    supabase
      .from('subjects')
      .select('*, departments(*), profiles(*)')
      .order('subject_code'),
    supabase.from('departments').select('*').order('name'),
    supabase.from('profiles').select('*').eq('role', 'subject_teacher').order('full_name'),
  ])

  return (
    <SubjectUpload
      subjects={(subjects ?? []) as Parameters<typeof SubjectUpload>[0]['subjects']}
      departments={departments ?? []}
      teachers={teachers ?? []}
    />
  )
}
