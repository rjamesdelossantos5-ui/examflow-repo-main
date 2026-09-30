import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { testToolsEnabled } from '@/lib/testTools'
import TestingTools from './TestingTools'

export const metadata = { title: 'EXAMFLOW Admin — Testing Tools' }

export default async function TestingPage() {
  // Off on a real deployment: the page doesn't exist unless ENABLE_TEST_TOOLS=true.
  if (!testToolsEnabled()) notFound()
  const supabase = await createClient()

  const [{ data: offerings }, { data: enrollments }] = await Promise.all([
    supabase.from('class_offerings').select('section'),
    supabase.from('test_enrollments').select('email, section').order('email'),
  ])

  const sections = [...new Set((offerings ?? []).map((o) => String(o.section)))].sort()
  return (
    <TestingTools
      sections={sections}
      enrollments={(enrollments ?? []) as { email: string; section: string }[]}
      migrationMissing={enrollments === null}
    />
  )
}
