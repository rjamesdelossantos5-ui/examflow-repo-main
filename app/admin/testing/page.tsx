import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { testToolsEnabled } from '@/lib/testTools'
import TestingTools from './TestingTools'

export const metadata = { title: 'EXAMFLOW Admin — Testing Tools' }

export default async function TestingPage() {
  // Off on a real deployment: the page doesn't exist unless ENABLE_TEST_TOOLS=true.
  if (!testToolsEnabled()) notFound()
  const supabase = await createClient()

  const [{ data: offerings }, { data: enrollments }, { data: accounts }] = await Promise.all([
    supabase.from('class_offerings').select('section'),
    supabase.from('test_enrollments').select('email, section').order('email'),
    supabase.from('test_accounts').select('user_id'),
  ])
  // test_accounts points at auth.users, not profiles, so the names are a second read.
  const ids = (accounts ?? []).map((a) => a.user_id as string)
  const { data: profiles } = ids.length
    ? await supabase.from('profiles').select('full_name, email').in('id', ids).order('full_name')
    : { data: [] }

  const sections = [...new Set((offerings ?? []).map((o) => String(o.section)))].sort()
  return (
    <TestingTools
      sections={sections}
      enrollments={(enrollments ?? []) as { email: string; section: string }[]}
      testTeachers={(profiles ?? []).map((p) => ({ name: p.full_name as string, email: p.email as string }))}
      migrationMissing={enrollments === null || accounts === null}
    />
  )
}
