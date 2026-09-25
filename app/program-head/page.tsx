import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { keepActive } from '@/lib/examSettings'
import { getActivePeriodCached } from '@/lib/activePeriod'
import { getCurrentUser } from '@/lib/currentUser'
import { getMyProfileMeta } from '@/lib/myProfile'
import { keepMyDepartment } from '@/lib/deptFilter'
import { withRegistrarGate } from '@/lib/registrarGate'
import { REVERIFY_LOG_PREFIX } from '@/lib/rejectReasons'
import PHQueue from './PHQueue'

export const metadata = { title: 'EXAMFLOW — Program Head Queue' }

/** The reason from the most recent "returned for re-verification" log line, or
 *  null if this request was never returned. */
function latestReverifyReason(logs: { action?: string; created_at?: string }[]): string | null {
  const returned = logs
    .filter((l) => typeof l.action === 'string' && l.action.startsWith(REVERIFY_LOG_PREFIX))
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
  return returned[0]?.action?.slice(REVERIFY_LOG_PREFIX.length) ?? null
}

export default async function ProgramHeadPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Gated like the Registrar's queue (lib/registrarGate.ts). Every request that
  // reaches first approval passed that gate once — but one the Program Head
  // returns for re-verification stays 'approved_by_teacher' with its
  // verification cleared, and must stay out of here until the parent passes
  // again and the student presses Submit.
  const { data: raw } = await withRegistrarGate((gate) => {
    let q = supabase
      .from('special_exam_requests')
      .select(`
        *,
        student:profiles!student_id(full_name, student_number, course, year_level, section),
        routed_teacher:profiles!teacher_id(full_name),
        subjects(
          subject_code, subject_name, department_id,
          profiles!teacher_id(full_name)
        ),
        application_media(id, media_type, storage_path, file_name, mime_type),
        progress_logs(id, action, created_at, actor_role)
      `)
      // First Approval: only requests the teacher just approved. Receipts are
      // handled separately on the Second Approval tab (/program-head/receipts).
      .eq('status', 'approved_by_teacher')
    if (gate) q = q.or(gate)
    return q.order('submitted_at', { ascending: false })
  })

  // A Program Head only approves their own department's subjects.
  const [activePeriod, meta] = await Promise.all([getActivePeriodCached(), getMyProfileMeta()])
  const activeId = activePeriod?.id ?? null
  const requests = keepMyDepartment(keepActive(raw ?? [], activeId), meta?.department_id ?? null).map((r) => {
    const subj = r.subjects as unknown as {
      subject_code: string
      subject_name: string
      profiles: { full_name: string } | null
    }
    const p = r.student as unknown as { full_name: string; student_number: string | null; course: string | null; year_level: number | null; section: string | null } | null
    const routedTeacher = r.routed_teacher as unknown as { full_name: string } | null
    const s = r as { snap_name?: string | null; snap_student_number?: string | null; snap_course?: string | null; snap_year_level?: number | null; snap_section?: string | null }
    return {
      ...r,
      student: {
        full_name: s.snap_name ?? p?.full_name ?? '—',
        student_number: s.snap_student_number ?? p?.student_number ?? null,
        course: s.snap_course ?? p?.course ?? null,
        year_level: s.snap_year_level ?? p?.year_level ?? null,
        section: s.snap_section ?? p?.section ?? null,
      },
      subject: {
        subject_code: subj?.subject_code ?? '',
        subject_name: subj?.subject_name ?? '',
        teacher: routedTeacher ?? subj?.profiles ?? null,
      },
      // The Program Head reviews the excuse certificate for excused requests.
      // The parent's ID and selfie are not uploaded files: they are Didit's
      // photos, loaded on demand by the panel (see verification-photo/route.ts).
      media: ((r.application_media ?? []) as { id: string; media_type: string; storage_path: string; file_name: string; mime_type: string }[])
        .filter((m) => m.media_type === 'supporting_document'),
      logs: r.progress_logs ?? [],
      resubmitted: ((r.progress_logs ?? []) as { action?: string }[]).some((l) => typeof l.action === 'string' && l.action.startsWith('Resubmitted')),
      // Returned for re-verification before, and now back — with the reason the
      // Program Head gave, so they know what to look at again.
      reverifyReason: latestReverifyReason((r.progress_logs ?? []) as { action?: string; created_at?: string }[]),
      verification: r.didit_session_id
        ? {
            faceMatchScore: (r.didit_face_match_score as number | null) ?? null,
            livenessScore: (r.didit_liveness_score as number | null) ?? null,
            idName: (r.didit_id_name as string | null) ?? null,
          }
        : null,
    }
  })

  return (
    <div className="space-y-4">
      {/* A term can now be current without a submission window (see
          supabase/migration_optional_window.sql). That is deliberate, but it
          means submissions are shut and nothing else on this page would say so
          — an empty queue looks the same either way. */}
      {activePeriod && !activePeriod.submissionStart && (
        <div className="rounded-lg px-4 py-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
          <strong>No submission window set</strong> for the current term, so students can&apos;t submit.{' '}
          <Link href="/program-head/settings" className="underline font-semibold">Set the dates</Link> when you have them.
        </div>
      )}
      <PHQueue
        requests={requests}
        title="First Approval"
        emptyText="No requests awaiting first approval."
      />
    </div>
  )
}
