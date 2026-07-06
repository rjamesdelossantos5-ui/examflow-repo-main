import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OverviewClient, { type OverviewRow } from './OverviewClient'

export const metadata = { title: 'EXAMFLOW — Overview' }

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role, can_override').eq('id', user.id).single()
  const canOverride = me?.role === 'admin' || !!me?.can_override

  const { data } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      profiles!student_id(full_name, section),
      subjects(subject_code, subject_name)
    `)
    // Once scheduled, a request is done — it drops off the overview.
    .neq('status', 'scheduled')
    .order('submitted_at', { ascending: false })

  const rows: OverviewRow[] = (data ?? []).map((r) => {
    const prof = r.profiles as unknown as { full_name: string; section: string | null } | null
    const subj = r.subjects as unknown as { subject_code: string; subject_name: string } | null
    const s = r as { snap_name?: string | null; snap_section?: string | null }
    return {
      id: r.id as string,
      status: r.status,
      exam_type: r.exam_type as string,
      submitted_at: r.submitted_at as string,
      name: s.snap_name ?? prof?.full_name ?? '—',
      section: s.snap_section ?? prof?.section ?? null,
      subject_code: subj?.subject_code ?? '',
      subject_name: subj?.subject_name ?? '',
      rejected_by_role: (r.rejected_by_role as string | null) ?? null,
      rejection_reason: (r.rejection_reason as string | null) ?? null,
    }
  })

  return <OverviewClient rows={rows} canOverride={canOverride} />
}
