import type { createClient } from '@/lib/supabase/server'
import { keepActive } from '@/lib/examSettings'
import { activePeriodIdCached } from '@/lib/activePeriod'
import { keepMyDepartment } from '@/lib/deptFilter'
import { purgeExpiredExams } from '@/lib/purgeExpiredExams'
import { withRegistrarGate } from '@/lib/registrarGate'
import type { OverviewRow } from './OverviewClient'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/**
 * Every unfinished request of the active term, newest first. A Program Head
 * passes their department; the admin passes null, which keeps every
 * department (lib/deptFilter.ts). Shared by /program-head/overview and
 * /admin/requests so both list exactly the same forms.
 */
export async function loadOverviewRows(supabase: SupabaseServer, departmentId: string | null): Promise<OverviewRow[]> {
  // Drop forms whose exam date has already passed before listing (see helper).
  await purgeExpiredExams(supabase)

  // Same gate as the Registrar's queue (lib/registrarGate.ts). Without it this
  // listed forms the parent had not verified and the student had not submitted
  // as "Waiting for Registrar" — false, they are waiting on the student.
  const { data } = await withRegistrarGate((gate) => {
    let q = supabase
      .from('special_exam_requests')
      .select(`
        *,
        profiles!student_id(full_name, section),
        subjects(subject_code, subject_name, department_id)
      `)
      // Once scheduled, a request is done — it drops off the overview.
      .neq('status', 'scheduled')
    if (gate) q = q.or(gate)
    return q.order('submitted_at', { ascending: false })
  })

  const activeId = await activePeriodIdCached()
  return keepMyDepartment(keepActive(data ?? [], activeId), departmentId).map((r) => {
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
}
