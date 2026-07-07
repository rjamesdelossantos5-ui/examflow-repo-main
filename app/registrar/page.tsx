import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { keepActive, computeWindow, TERM_LABEL } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import StaffWindowBanner from '@/components/StaffWindowBanner'
import RegistrarQueue from './RegistrarQueue'

export const metadata = { title: 'EXAMFLOW — Registrar Queue' }

export default async function RegistrarPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      profiles!student_id(full_name),
      subjects(subject_code, subject_name),
      application_media(id, media_type, storage_path, file_name, mime_type),
      progress_logs(id, action, created_at, actor_role)
    `)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })

  // Only the active term's forms show; the previous term drops off once a new
  // term is activated in Settings.
  const activePeriod = await getActivePeriodCached()
  const activeId = activePeriod?.id ?? null
  const win = computeWindow(activePeriod?.submissionStart ?? null, activePeriod?.windowDays ?? 7)
  const requests = keepActive(raw ?? [], activeId).map((r) => {
    const prof = r.profiles as unknown as { full_name: string } | null
    return {
      ...r,
      student: { full_name: (r as { snap_name?: string | null }).snap_name ?? prof?.full_name ?? '—' },
      subject: r.subjects as unknown as { subject_code: string; subject_name: string },
      // Registrar verifies identity documents only. The medical/death certificate
      // is private and shown to the Program Head, not the Registrar.
      media: ((r.application_media ?? []) as { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string }[])
        .filter((m) => ['parent_id', 'parent_id_back', 'parent_signature'].includes(m.media_type)),
      logs: r.progress_logs ?? [],
      resubmitted: ((r.progress_logs ?? []) as { action?: string }[]).some((l) => typeof l.action === 'string' && l.action.startsWith('Resubmitted')),
    }
  })

  return (
    <>
      <StaffWindowBanner
        termLabel={activePeriod ? TERM_LABEL[activePeriod.term] : null}
        open={win.open}
        notStarted={win.notStarted}
        daysRemaining={win.daysRemaining}
        end={win.end}
        examDay={activePeriod?.examDay ?? null}
        examEndDay={activePeriod?.examEndDay ?? null}
      />
      <RegistrarQueue requests={requests} />
    </>
  )
}
